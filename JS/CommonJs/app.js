const menuBtn = document.querySelector(".menu-icon i");
const navElement = document.querySelector("nav");
const navItem = document.querySelectorAll("nav ul li");
const mode = document.querySelector(".mode");
const modeIcon = document.querySelector(".mode i");
const bodyElement = document.body;

if (menuBtn && navElement) {
    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        menuBtn.classList.toggle("fa-bars");
        menuBtn.classList.toggle("fa-xmark");
        navElement.classList.toggle("showmenu");
    });
}
if(bodyElement && menuBtn && navElement){
    bodyElement.addEventListener("click",()=>{
        navElement.classList.remove("showmenu")
        menuBtn.classList.add("fa-bars");
        menuBtn.classList.remove("fa-xmark");
    })
}
if(navElement){
    navElement.addEventListener("click",(e)=>{
        e.stopPropagation();
    })
}

const saveMode = localStorage.getItem("theme");

if (saveMode === "dark" && bodyElement && modeIcon) {
    bodyElement.classList.remove("light");
        modeIcon.classList.add("fa-sun");
        modeIcon.classList.remove("fa-moon");
    }
    else{
        bodyElement.classList.add("light")
        modeIcon.classList.remove("fa-sun")
        modeIcon.classList.add("fa-moon")
    }

if (mode && bodyElement && modeIcon) {
    mode.addEventListener("click", (e) => {
        e.preventDefault();
        bodyElement.classList.toggle("light");
        modeIcon.classList.toggle("fa-sun");
        modeIcon.classList.toggle("fa-moon");

        if (bodyElement.classList.contains("light")) {
            localStorage.setItem("theme", "light");
        } else {
            localStorage.setItem("theme", "dark");
        }
    });
}

if (menuBtn && navElement && navItem.length) {
    for (const item of navItem) {
        item.addEventListener("click", () => {
            menuBtn.classList.add("fa-bars");
            menuBtn.classList.remove("fa-xmark");
            navElement.classList.remove("showmenu");
        });
    }
}

const body = document.body;
const projectItem = document.querySelectorAll(".project-item");
const overlaySection = document.querySelector(".overlay-section");
const overlayContainer = document.querySelector(".overlay-container");
const overlayImg = document.querySelector(".overlay-img img");
const closeBtn = document.querySelector(".overlay-img span");
const overlayDetailsHeading = document.querySelector(".overlay-details-left h2");
const aboutProject = document.querySelector(".overlay-details-left p");
const projectFirstHeading = document.querySelector(".overlay-details-left h5");
const techbtn = document.querySelector(".overlay-techs");
const visitWebsite = document.querySelector(".overlay-visit-website .visit");
const github = document.querySelector(".overlay-visit-website .overlay-github");
const year = document.querySelector(".overlay-year span");

for (const item of projectItem) {
    const projectImage = item.querySelector("img");

    if (!projectImage) {
        continue;
    }

    projectImage.addEventListener("click", () => {
        if (!overlaySection || !overlayImg || !projectFirstHeading || !aboutProject || !overlayDetailsHeading || !techbtn || !visitWebsite || !github || !year) {
            return;
        }

        const itemProjectAbout = item.querySelector(".about-project");
        const projectTechBtns = item.querySelectorAll(".tech-btn a");
        const liveDemo = item.querySelector(".live-demo");
        const githubLink = item.querySelector(".github");
        const yearLabel = item.querySelector(".year p");
        const heading = item.querySelector("h3");
        const subheading = item.querySelector("h6");

        overlayImg.src = projectImage.src;
        overlaySection.classList.add("showoverlay");
        body.classList.add("stop-scroll");

        projectFirstHeading.innerHTML = subheading ? subheading.innerHTML : "";
        aboutProject.innerHTML = itemProjectAbout ? itemProjectAbout.innerHTML : "";
        overlayDetailsHeading.innerHTML = heading ? heading.innerHTML : "";
        year.innerHTML = yearLabel ? `<p>${yearLabel.innerHTML}</p>` : "";

        techbtn.innerHTML = "";
        for (const projectTechBtn of projectTechBtns) {
            techbtn.innerHTML += `<span>${projectTechBtn.innerHTML}</span>`;
        }

        if (liveDemo) {
            visitWebsite.href = liveDemo.href;
        }

        if (githubLink) {
            github.href = githubLink.href;
        }
    });
}

if (closeBtn && overlaySection) {
    closeBtn.addEventListener("click", () => {
        overlaySection.classList.remove("showoverlay");
        body.classList.remove("stop-scroll");
    });
}

if (overlaySection) {
    overlaySection.addEventListener("click", () => {
        overlaySection.classList.remove("showoverlay");
        body.classList.remove("stop-scroll");
    });
}

if (overlayContainer) {
    overlayContainer.addEventListener("click", (e) => {
        e.stopPropagation();
    });
}

const form = document.querySelector(".contact-forms");
const name = document.getElementById("name");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const message = document.getElementById("message");
const msg = document.querySelector(".form-msg");

if (form && name && email && message && msg) {
    form.addEventListener("submit", (e) => {
        e.preventDefault();

        if (name.value.trim() === "" || email.value.trim() === "" || message.value.trim() === "") {
            msg.innerHTML = "Please fill all required fields.";
            msg.style.opacity = "1";
            msg.style.color = "#fa0961";

            setTimeout(() => {
                msg.style.opacity = "0";
            }, 2500);

            return;
        }

        const data = {
            name: name.value,
            email: email.value,
            phone: phone ? phone.value : "",
            message: message.value
        };

        fetch("https://script.google.com/macros/s/AKfycbwqGBNly4iFyCUSNwF0tTo7sbqUZAQ_pVymT4X2OSY9G5XTXtuXcfyKSXty-isXhIHq/exec", {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
            .then(() => {
                msg.innerHTML = "Message Sent Successfully!";
                msg.style.opacity = "1";
                msg.style.color = "#01be01";
                form.reset();

                setTimeout(() => {
                    msg.style.opacity = "0";
                }, 2500);
            })
            .catch(() => {
                msg.innerHTML = "Error sending message.";
                msg.style.opacity = "1";
                msg.style.color = "red";

                setTimeout(() => {
                    msg.style.opacity = "0";
                }, 2500);
            });
    });
}

const shareBtn = document.querySelector(".share");
if (shareBtn) {
    shareBtn.addEventListener("click", () => {
        if (navigator.share) {
            navigator.share({
                title: document.title,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied!");
        }
    });
}

const prevBtn=document.querySelector(".prevbtn")
const nextBtn=document.querySelector(".nextbtn")
const prevBlogTitle=document.querySelector(".prevbtn span")
const nextBlogTitle=document.querySelector(".nextbtn span")

const blogs = [
  { id: 1, title: "How to improve Web Design", url: "../Writing/Blog1.html?id=1" },
  { id: 2, title: "JavaScript Enhances Interactivity", url: "../Writing/Blog2.html?id=2" },
  { id: 3, title: "From Junior to Senior: My Learning Journey", url: "../Writing/Blog3.html?id=3" }
];

const params = new URLSearchParams(window.location.search);
let currentBlogId = Number(params.get("id"));

function render(){
    const index=blogs.findIndex(blog=>blog.id===currentBlogId)
    const prevBlog =index>0? blogs[index-1]:null;
    const nextBlog =index<blogs.length-1 ? blogs[index+1]:null;
    prevBlogTitle.textContent=prevBlog ? prevBlog.title :"";
    nextBlogTitle.innerHTML=nextBlog ? nextBlog.title:"";
    prevBtn.disabled=!prevBlog;
    nextBtn.disabled=!nextBlog;
}

prevBtn.addEventListener("click",()=>{
    const index=blogs.findIndex(blog=>blog.id===currentBlogId)
    if(index>0){
        window.location.href = blogs[index - 1].url;
    }
})
nextBtn.addEventListener("click",()=>{
    const index=blogs.findIndex(blog=>blog.id===currentBlogId)
    if(index<blogs.length-1){
        window.location.href = blogs[index + 1].url;
    }
})
render();
 
