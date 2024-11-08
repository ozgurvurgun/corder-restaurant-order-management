export default class Scroll {
  constructor(publicWrapper, contentWrapper, speed) {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    if (isMobile) {
      return;
    }

    const scrollContainer = publicWrapper;

    const scrollContent = contentWrapper;

    let isDown = false;

    let startX, scrollLeft;

    scrollContainer.addEventListener("mousedown", (e) => {
      isDown = true;

      scrollContainer.classList.add("active");

      startX = e.pageX - scrollContainer.offsetLeft;

      scrollLeft = scrollContent.scrollLeft;
    });

    scrollContainer.addEventListener("mouseleave", () => {
      isDown = false;

      scrollContainer.classList.remove("active");
    });

    scrollContainer.addEventListener("mouseup", () => {
      isDown = false;

      scrollContainer.classList.remove("active");
    });

    scrollContainer.addEventListener("mousemove", (e) => {
      if (!isDown) return;

      e.preventDefault();

      const x = e.pageX - scrollContainer.offsetLeft;

      const walk = (x - startX) * speed; //scroll-fast

      scrollContent.scrollLeft = scrollLeft - walk;
    });
  }
}
