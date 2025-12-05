// ===========================================
// UMYU SUPABASE CONNECTION SCRIPT
// ===========================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// REPLACE WITH YOUR ACTUAL URL AND ANON KEY
const SUPABASE_URL = 'https://rhwwbvwkctejoyhzesge.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_m3osvNGF4kmQjoSNeq4qWA_Qbgo3Z6j'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================================
// PAGE ROUTER
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('loginForm')) {
        setupLoginPage();
    } else if (document.getElementById('ballot-box')) {
        setupVotingPage();
    }
});

// ===========================================
// LOGIN LOGIC (index.html)
// ===========================================
function setupLoginPage() {
    if (localStorage.getItem("umyuUser")) {
        window.location.href = "voting.html";
        return;
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById("loginBtn");
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value.trim();
        const errorMsg = document.getElementById("error-message");

        // Simple Regex for UMYU
        if (!email.endsWith('@students.umyu.edu.ng')) {
            alert("Use a valid school email (@students.umyu.edu.ng)");
            return;
        }

        btn.innerText = "Verifying...";
        btn.disabled = true;

        try {
            // Check student
            const { data: user, error } = await supabase.from('students').select('*').eq('email', email).single();
            
            if (!user) {
                // Register if not exists
                await supabase.from('students').insert([{ email, password }]);
            } else if (user.password !== password) {
                throw new Error("Incorrect Password");
            }

            localStorage.setItem("umyuUser", email);
            window.location.href = "voting.html";

        } catch (err) {
            console.error(err);
            if(errorMsg) {
                errorMsg.innerText = err.message;
                errorMsg.style.display = 'block';
            } else {
                alert(err.message);
            }
            btn.innerText = "Login";
            btn.disabled = false;
        }
    });
}

// ===========================================
// VOTING LOGIC (voting.html)
// ===========================================
async function setupVotingPage() {
    const userEmail = localStorage.getItem("umyuUser");
    const container = document.getElementById('ballot-box');
    
    if (!userEmail) {
        window.location.href = "index.html";
        return;
    }

    document.getElementById('user-display').innerText = userEmail;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem("umyuUser");
        window.location.href = "index.html";
    });

    try {
        // 1. Fetch Candidates
        const { data: candidates, error: candError } = await supabase
            .from('candidates')
            .select('*')
            .order('id', { ascending: true });

        // 2. Fetch User's Votes
        const { data: myVotes, error: voteError } = await supabase
            .from('votes')
            .select('position, candidate_id')
            .eq('student_email', userEmail);

        if (candError) throw candError;

        // 3. Group Candidates by Position
        const grouped = {};
        candidates.forEach(c => {
            if (!grouped[c.position]) grouped[c.position] = [];
            grouped[c.position].push(c);
        });

        // 4. Render UI
        container.innerHTML = '';
        
        // Define specific order of positions if desired, or just use Object.keys
        const positionOrder = [
            'President', 'Vice President', 'Secretary General', 'Financial Secretary', 
            'Assistant Gen. Sec.', 'Treasurer', 'PRO I', 'PRO II', 
            'Social & Welfare', 'Auditor General', 'Sales Director', 
            'Sports Director', 'Food Director', 'Hall Rep (Male)', 'Hall Rep (Female)'
        ];

        // Combine known order with any others found in DB
        const allPositions = [...new Set([...positionOrder, ...Object.keys(grouped)])];

        allPositions.forEach(pos => {
            const posCandidates = grouped[pos];
            if (!posCandidates) return;

            // Check if user already voted for this position
            const voteRecord = myVotes.find(v => v.position === pos);
            const hasVotedForThisPos = !!voteRecord;

            const section = document.createElement('div');
            section.className = 'position-section';
            
            let html = `<h2 class="position-title">${pos}</h2><div class="candidates-grid">`;

            posCandidates.forEach(cand => {
                const isSelected = voteRecord && voteRecord.candidate_id === cand.id;
                
                // Logic: Disable if user voted for this position (unless it's the one they voted for)
                let btnState = hasVotedForThisPos ? 'disabled' : '';
                let btnText = 'Vote';
                let btnClass = 'vote-btn';

                if (isSelected) {
                    btnText = 'Voted ✓';
                    btnClass += ' voted-badge'; // Change style
                } else if (hasVotedForThisPos) {
                    btnText = '---';
                }

                html += `
                <div class="candidate-card">
                    <div class="card-header">Candidate</div> <div class="card-body">
                        <div class="candidate-name">${cand.name}</div>
                        <div class="reg-no">${cand.reg_no}</div>
                        <br><br>
                        ${isSelected 
                            ? `<div class="${btnClass}">${btnText}</div>`
                            : `<button class="${btnClass}" ${btnState} onclick="submitVote(${cand.id}, '${pos}')">${btnText}</button>`
                        }
                    </div>
                </div>`;
            });

            html += `</div>`;
            section.innerHTML = html;
            container.appendChild(section);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="color:red; text-align:center">Error loading election data.</p>`;
    }
}

// GLOBAL VOTE FUNCTION
window.submitVote = async function(candidateId, position) {
    const userEmail = localStorage.getItem("umyuUser");
    if (!confirm(`Cast vote for ${position}? This cannot be undone.`)) return;

    try {
        // 1. Check double vote (Frontend check is good, backend is better)
        const { data: existing } = await supabase
            .from('votes')
            .select('*')
            .eq('student_email', userEmail)
            .eq('position', position)
            .single();

        if (existing) {
            alert("You have already voted for this position!");
            location.reload();
            return;
        }

        // 2. Insert Vote
        const { error: voteErr } = await supabase
            .from('votes')
            .insert([{ student_email: userEmail, position: position, candidate_id: candidateId }]);

        if (voteErr) throw voteErr;

        // 3. Increment Counter
        const { data: cand } = await supabase.from('candidates').select('vote_count').eq('id', candidateId).single();
        await supabase.from('candidates').update({ vote_count: cand.vote_count + 1 }).eq('id', candidateId);

        alert("Vote Submitted!");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Vote failed. Check connection.");
    }
};