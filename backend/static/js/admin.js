// ================= PROFILE DROPDOWN =================
function toggleDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById("profileDropdown");
    dropdown.classList.toggle("show");
}

// Close dropdown kapag click sa labas
document.addEventListener("click", function(e){
    const dropdown = document.getElementById("profileDropdown");
    const profile = document.getElementById("profileMenu");
    if (!profile.contains(e.target)) {
        dropdown.classList.remove("show");
    }
});



// ================= DARKMODE =================
function toggleDropdown(event){
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.toggle('show');
}

// DARK MODE
const toggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    if (toggle) toggle.checked = true;
    themeIcon.classList.replace("bi-moon","bi-sun");
}

if (toggle) {
    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("theme", "dark");
            themeIcon.classList.replace("bi-moon","bi-sun");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("theme", "light");
            themeIcon.classList.replace("bi-sun","bi-moon");
        }
    });
}
