import { useEffect } from 'react';

/* Scroll-reveal toàn cục: một IntersectionObserver duy nhất quan sát mọi phần tử
   `.reveal` trong DOM (kể cả các trang lazy-load mount sau), thêm class `.is-in`
   khi phần tử đi vào viewport rồi bỏ theo dõi — mỗi phần tử chỉ reveal một lần.
   MutationObserver bắt các node `.reveal` mới xuất hiện nên không cần gọi hook
   ở từng trang. CSS tương ứng nằm trong App.css (.reveal / .reveal.is-in). */
const useRevealOnScroll = () => {
  useEffect(() => {
    const show = (el) => el.classList.add('is-in');

    let io = null;
    try {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              show(entry.target);
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -7% 0px', threshold: 0.06 }
      );
    } catch {
      io = null; // Trình duyệt không hỗ trợ → hiện thẳng nội dung
    }

    const scan = () => {
      document.querySelectorAll('.reveal:not(.is-in)').forEach((el) => {
        if (io) io.observe(el);
        else show(el);
      });
    };

    scan();

    /* Progressive enhancement fallback: nội dung không được phép biến mất nếu
       observer bị trễ, route lazy-load vừa mount hoặc môi trường chụp không
       phát sinh intersection event. Khi observer hoạt động bình thường, các
       phần tử vẫn reveal theo viewport như thiết kế; sau 1.5s chỉ những node
       còn sót lại mới được hiện ra. */
    const fallbackTimer = window.setTimeout(() => {
      document.querySelectorAll('.reveal:not(.is-in)').forEach(show);
    }, 1500);

    let mo = null;
    try {
      mo = new MutationObserver(scan);
      mo.observe(document.body, { childList: true, subtree: true });
    } catch {
      mo = null;
    }

    return () => {
      if (io) io.disconnect();
      if (mo) mo.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);
};

export default useRevealOnScroll;