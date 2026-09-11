// FAQ accordion
document.querySelectorAll('.fq').forEach(function(q) {
  q.addEventListener('click', function() {
    var item = this.closest('.fitem');
    var isOpen = item.classList.contains('open');
    document.querySelectorAll('.fitem.open').forEach(function(i){ i.classList.remove('open'); });
    if (!isOpen) item.classList.add('open');
  });
});

// Hamburger mobile menu
var hamburger = document.getElementById('hamburger');
var mobileMenu = document.getElementById('mobile-menu');
if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', function() {
    mobileMenu.classList.toggle('open');
    // animate hamburger to X
    var spans = hamburger.querySelectorAll('span');
    if (mobileMenu.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      document.body.style.overflow = 'hidden';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
      document.body.style.overflow = '';
    }
  });
  // Close menu when a link is clicked
  mobileMenu.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function() {
      mobileMenu.classList.remove('open');
      var spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity = '';
      spans[2].style.transform = '';
      document.body.style.overflow = '';
    });
  });
}

// Active nav link — Vercel serves this site with clean URLs (/talent, not
// /talent.html), so location.pathname never literally matches a
// href="talent.html". Stripping a trailing .html from both sides before
// comparing makes it match either way (a direct .html file open still
// works too, e.g. testing locally without a server).
var path = window.location.pathname.split('/').pop() || 'index';
path = path.replace(/\.html$/, '');
document.querySelectorAll('.nav-links a:not(.nav-cta)').forEach(function(a) {
  var href = (a.getAttribute('href') || '').replace(/\.html$/, '');
  if (href === path) a.classList.add('active');
});

// Waitlist form
var wf = document.getElementById('wf');
if (wf) {
  wf.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = wf.querySelector('button');
    btn.textContent = 'Joining...'; btn.disabled = true;
    var email = wf.querySelector('input[name="email"]').value;
    fetch(wf.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    })
      .then(function(r) {
        if (r.ok) { wf.innerHTML = '<p style="font-size:16px;font-weight:600;padding:14px 0">You\'re on the list. We\'ll be in touch soon \uD83C\uDF89</p>'; }
        else { btn.textContent = 'Get early access'; btn.disabled = false; }
      }).catch(function(){ btn.textContent = 'Get early access'; btn.disabled = false; });
  });
}
