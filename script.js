// ===========================================
// UMYU SUPABASE CONNECTION SCRIPT
// ===========================================

// 1. Import Supabase from ESM CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 2. Your Supabase Configuration
const SUPABASE_URL = 'https://rhwwbvwkctejoyhzesge.supabase.co';
// WARNING: Use the ANON key here, NOT the service_role (secret) key.
const SUPABASE_ANON_KEY = 'sb_publishable_m3osvNGF4kmQjoSNeq4qWA_Qbgo3Z6j'; 

// 3. Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 4. Handle Login Form
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
    event.preventDefault();

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const btn = document.getElementById("loginBtn"); 
    const errorMsg = document.getElementById("error-message");

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();

    // --- VALIDATION STEPS ---
    const emailPattern = /^[a-z0-9._-]+@students\.umyu\.edu\.ng$/i;

    if (!emailPattern.test(email)) {
        alert("Please enter a valid UMYU student email.\nExample: csc220875@students.umyu.edu.ng");
        return;
    }

    if (password.length < 3) {
        alert("Password is too short.");
        return;
    }

    // --- BACKEND STORAGE STEPS ---
    
    // UI Loading State
    const originalBtnText = btn.innerText;
    btn.innerText = "Verifying...";
    btn.disabled = true;
    if(errorMsg) errorMsg.style.display = 'none';

    try {
        // 1. Check if user exists in the 'students' table
        const { data: existingUser, error: fetchError } = await supabase
            .from('students')
            .select('*')
            .eq('email', email)
            .single();

        const timestamp = new Date().toISOString();

        if (!existingUser) {
            // CASE A: NEW USER (First time login)
            // We register them by inserting their email AND password
            const { error: insertError } = await supabase
                .from('students')
                .insert([
                    { 
                        email: email, 
                        password: password, // Storing plain text (Simple for school project, unsafe for production)
                        has_voted: false,
                        last_login: timestamp
                    }
                ]);

            if (insertError) throw insertError;
            
        } else {
            // CASE B: RETURNING USER
            // Verify Password
            if (existingUser.password !== password) {
                throw new Error("Incorrect password. Please try again.");
            }

            // Update last login time
            await supabase
                .from('students')
                .update({ last_login: timestamp })
                .eq('id', existingUser.id);
        }

        // 2. Store session locally
        localStorage.setItem("umyuUser", email);
        
        // 3. Redirect to voting page
        window.location.href = "voting.html";

    } catch (error) {
        console.error("Login Error:", error);
        
        if(errorMsg) {
            // Show specific password error or generic system error
            errorMsg.innerText = error.message.includes("password") 
                ? error.message 
                : "System Error: Could not connect to database.";
            errorMsg.style.display = 'block';
        } else {
            alert(error.message);
        }
        
        // Reset button
        btn.innerText = originalBtnText;
        btn.disabled = false;
    }
}