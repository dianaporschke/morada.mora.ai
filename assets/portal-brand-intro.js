const intro=document.getElementById('portalBrandIntro');
const logo=document.querySelector('#moradaEntry .entry-logo');
if(intro&&logo){
 const source=logo.getAttribute('src');
 intro.querySelectorAll('image').forEach(image=>image.setAttribute('href',source));
 intro.addEventListener('animationend',event=>{
  if(event.target===intro&&event.animationName==='portal-brand-depart')intro.remove();
 });
}
