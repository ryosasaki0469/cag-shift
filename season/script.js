// ご予約サイトのURLはここだけ書き換えてください
const RESERVE_URL = '#info';

document.querySelectorAll('[data-reserve]').forEach(a => {
  a.href = RESERVE_URL;
  if (/^https?:/.test(RESERVE_URL)) { a.target = '_blank'; a.rel = 'noopener'; }
});

const header = document.querySelector('.site-header');
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('nav');
addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 40), { passive: true });
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
nav.addEventListener('click', e => {
  if (e.target.closest('a')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', false); }
});

const targets = document.querySelectorAll('.section > *, .card, .seat');
targets.forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .15 });
targets.forEach(el => io.observe(el));
