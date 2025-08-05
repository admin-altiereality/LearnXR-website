function sendMail(){
    let params = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      message: document.getElementById('message').value
    }
  
   
   emailjs.send("service_pe17h38", "template_y6neyor",params).then(alert("Email sent"))
  }
