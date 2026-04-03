let navElement = document.querySelectorAll('.header ul li a');

for (let v of navElement) {
  v.addEventListener('click', () => {
    for (let t of navElement) {
      t.classList.remove('current');
    }
    v.classList.add('current');
  });
}

let barsDetails = document.querySelector('.bars-details');
let bars = document.querySelector('.header ul li:nth-child(7)');

bars.addEventListener('click', () => {
  barsDetails.classList.toggle('show');
});


let gallery=document.querySelector(".gallery")
let images=document.querySelectorAll(".gallery img")
let prev=document.querySelector(".prevbtn")
let next=document.querySelector(".nextbtn")
let dots=document.querySelectorAll(".dots .dot")
let projectView=document.querySelector(".view-project")
let projects=document.querySelectorAll(".projects a")
let index=0;

function updateDots(){
  let i=0;
  for(let dot of dots){
    if(i==index){
      dot.classList.add("dots-dark")
    } else{
      dot.classList.remove("dots-dark")
    }
    i++
  }
}

for(let i=0;i<=dots.length-1;i++){
  dots[i].addEventListener("click",()=>{
    index=i;
    gallery.style.transform=`translateX(-${index*600}px)`
    updateDots()
  })
}
next.addEventListener("click",(e)=>{
  index++
  if(index>images.length-1){
    index=0;
  }
  gallery.style.transform=`translateX(-${index*600}px)`
  updateDots()
  projectView.href=projects[index].href
})
prev.addEventListener("click",()=>{
  index--
  if(index<0){
    index=images.length-1
  }
  gallery.style.transform=`translateX(-${index*600}px)`
  updateDots()
   projectView.href=projects[index].href
})
updateDots()
projectView.href=projects[index].href


let track=document.querySelector(".feedback-track")
let Cards=document.querySelectorAll(".feedback-card")
let visibleCards=2;
let j=0;
let steps=Math.ceil(Cards.length/visibleCards)
setInterval(()=>{
  j++
  if(j>=steps){
    j=0
  }
  track.style.transform=`translateX(-${j*900}px)`
  updateFeedbackDots()
},2500)

let feedbackDots=document.querySelectorAll(".dots1 .dot")
function updateFeedbackDots(){
  let feedbackIndex=0;
  for(let dot of feedbackDots){
    if(feedbackIndex==j){
      dot.classList.add("show1")
    } else{
      dot.classList.remove("show1")
    }
    feedbackIndex++
  }
}

let layer=document.querySelector(".layer")
let modal=document.querySelector(".modal")
let closebtn=document.querySelector(".closebtn")
let modalDiv=document.querySelector(".modal-div")
 
for(let card of Cards){
  card.addEventListener("click",()=>{
    modalDiv.innerHTML=""
    let clone=card.cloneNode(true)
    modalDiv.appendChild(clone)
    layer.classList.add("active")
  })
}
closebtn.addEventListener("click",()=>{
  layer.classList.remove("active")
})
layer.addEventListener("click",()=>{
  layer.classList.remove("active")
})
modal.addEventListener("click",(e)=>{
  e.stopPropagation()
})
 

// let userName=document.querySelector(".inputname")
// let userMessage=document.querySelector(".inputmessage")
// let userEmail=document.querySelector(".inputemail")
// let form=document.querySelector("form")
// form.addEventListener("submit",(e)=>{
//   e.preventDefault()
//   if(userName.value.trim()===""){
//     alert("Name is required")
//     return
//   }
//   if(userEmail.value.trim()===""){
//     alert("Email is required")
//     return
//   }
//   if(userMessage.value.trim()===""){
//     alert("message is required")
//     return
//   }
//   alert("Form Submitted Successfully")
//   form.reset()
// //   userName.value = ""
// // userEmail.value = ""
// // userMessage.value = ""
// })

let timeDiv=document.querySelector(".time")

setInterval(()=>{
  let time=new Date()
  let hr=time.getHours().toString().padStart(2,"0")
  let min=time.getMinutes().toString().padStart(2,"0")
  let sec=time.getSeconds().toString().padStart(2,"0")
  let date=time.getDate().toString().padStart(2,"0") 
  let month=(time.getMonth()+1).toString().padStart(2,"0") 
  let year=time.getFullYear().toString() 
  
  timeDiv.innerHTML=`${hr}:${min}:${sec} • ${date}-${month}-${year}`
},1000)


let userName = document.querySelector(".inputname")
let userMessage = document.querySelector(".inputmessage")
let userEmail = document.querySelector(".inputemail")
let form = document.querySelector("form")

const scriptURL = "https://script.google.com/macros/s/AKfycbwci3X0rIZC3_8uFMNwQzfeYZ_qJCV3QCwzTslQ2l6q6aJpTRQKKrSD1VCMbg2pPwpySg/exec";

form.addEventListener("submit", function (e) {
  e.preventDefault()

  if (userName.value.trim() === "") {
    alert("Name is required")
    return
  }
  if (userEmail.value.trim() === "") {
    alert("Email is required")
    return
  }
  if (userMessage.value.trim() === "") {
    alert("Message is required")
    return
  }

  const formData = new FormData(form)

  fetch(scriptURL, {
    method: "POST",
    body: formData
  })
    .then(response => {
      alert("Message sent successfully ✅")
      form.reset()
    })
    .catch(error => {
      alert("Something went wrong ❌")
      console.error(error)
    })
})

// fetch("https://script.google.com/macros/s/AKfycbw6ZUQN2BaJtzCO6b4DrP0VDNyIKXgEdZpET5ZjD9gvu2pw4H5tUO3TTXYooNuxpBkoCg/exec", {
//   method: "POST",
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify({
//     name: document.querySelector(".inputname").value,
//     email: document.querySelector(".inputemail").value,
//     message: document.querySelector(".inputmessage").value
//   })
// })
// .then(res => res.text())
// .then(data => {
//   alert("Message Sent Successfully ✅")
//   form.reset()
// })
// .catch(error => {
//   alert("Something went wrong ❌")
// })


// let prevBtn = document.querySelector('#prev');
// let nextBtn = document.querySelector('#next');
// let track=document.querySelector(".project-slider")
// let itemElement = document.querySelectorAll('.item');
// let Number = document.querySelector('.number');
// let index = 0;

// nextBtn.addEventListener('click', () => {
//   index++;
//   if (index > itemElement.length - 1) {
//     index = 0;
//   }
//   for (let v of itemElement) {
//     v.style.transform = `translateX(-${100 * index}%)`;
//   }
// });
// prevBtn.addEventListener('click', () => {
//   index--;
//   if (index < 0) {
//     index = itemElement.length - 1;
//   }

//   for (let v of itemElement) {
//     v.style.transform = `translateX(-${100 * index}%)`;
//   }
// });

// let cards = document.querySelectorAll('.feedback-container .feedback-card');
// let cards = document.querySelectorAll('.feedback-container .feedback-card');
// let count = 0;
// let showCards=2;
// setInterval(() => {
//   for (let v of cards) {
//     v.classList.remove('current');
//   }
//   cards[count].classList.add('current');
//   count++;
//   if (count >= cards.length) {
//     count = 0;
//   }
// }, 1000);

// setInterval(() => {
//   if (index > itemElement.length - 1) {
//     index = 0;
//   }
  

//     track.style.transform = `translateX(-${100 * index}%)`;
     
//   index++;
  
// },1000);

