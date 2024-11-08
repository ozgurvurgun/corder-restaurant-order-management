export default class LazyLoader {
  constructor() {
    document.addEventListener("DOMContentLoaded", this.init());
  }

  init() {
    const lazyImages = document.querySelectorAll("img.lazy");

    if ("IntersectionObserver" in window) {
      let lazyImageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            let lazyImage = entry.target;

            lazyImage.src = lazyImage.dataset.src;

            lazyImage.classList.remove("lazy");

            lazyImageObserver.unobserve(lazyImage);
          }
        });
      });

      lazyImages.forEach((lazyImage) => {
        lazyImageObserver.observe(lazyImage);
      });
    } else {
      this.fallbackLazyLoad(lazyImages);
    }
  }

  fallbackLazyLoad(lazyImages) {
    const lazyLoad = () => {
      lazyImages.forEach((lazyImage) => {
        if (
          lazyImage.getBoundingClientRect().top < window.innerHeight &&
          lazyImage.getBoundingClientRect().bottom > 0 &&
          getComputedStyle(lazyImage).display !== "none"
        ) {
          lazyImage.src = lazyImage.dataset.src;

          lazyImage.classList.remove("lazy");
        }
      });

      if (lazyImages.length === 0) {
        document.removeEventListener("scroll", lazyLoad);

        window.removeEventListener("resize", lazyLoad);

        window.removeEventListener("orientationchange", lazyLoad);
      }
    };

    document.addEventListener("scroll", lazyLoad);

    window.addEventListener("resize", lazyLoad);

    window.addEventListener("orientationchange", lazyLoad);
  }
}
