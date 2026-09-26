import React, { useEffect, useRef, useState } from 'react';

/* Đếm số tăng dần từ 0 → end khi phần tử vào viewport (chỉ chạy một lần).
   Ease-out cubic cho cảm giác "chốt số" tự nhiên; tôn trọng
   prefers-reduced-motion bằng cách hiển thị luôn giá trị cuối. */
const CountUp = ({ end, duration = 1300, suffix = '', className = '' }) => {
  const ref = useRef(null);
  const startedRef = useRef(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof end !== 'number' || !Number.isFinite(end)) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(end);
      return undefined;
    }

    let raf = 0;
    let io = null;
    try {
      io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || startedRef.current) return;
          startedRef.current = true;
          io.disconnect();
          const t0 = performance.now();
          const tick = (now) => {
            const progress = Math.min((now - t0) / duration, 1);
            const eased = 1 - (1 - progress) ** 3;
            setValue(Math.round(eased * end));
            if (progress < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        });
      }, { threshold: 0.4 });
      io.observe(el);
    } catch {
      setValue(end);
    }

    return () => {
      if (io) io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [end, duration]);

  return <span ref={ref} className={className}>{value}{suffix}</span>;
};

export default CountUp;