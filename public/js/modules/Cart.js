export default class Cart {
  constructor() {
    let storedCart = localStorage.getItem("cart");
    try {
      storedCart = JSON.parse(storedCart);
    } catch (error) {
      console.log(error);
      storedCart = null;
    }
    this.cart = storedCart || [];
  }

  addToCart(product) {
    const existingProductIndex = this.cart.findIndex(
      (item) => item.id === product.id
    );

    if (existingProductIndex !== -1) {
      this.cart[existingProductIndex].amount++;
    } else {
      this.cart.push({ ...product, amount: 1 });
    }

    this.saveCartToLocalStorage();
  }

  removeFromCart(productId) {
    const existingProductIndex = this.cart.findIndex(
      (item) => item.id === productId
    );

    if (existingProductIndex !== -1) {
      this.cart[existingProductIndex].amount--;
      if (this.cart[existingProductIndex].amount === 0) {
        this.cart.splice(existingProductIndex, 1);
      }
      this.saveCartToLocalStorage();
      return true;
    }
    return false;
  }

  saveCartToLocalStorage() {
    localStorage.setItem("cart", JSON.stringify(this.cart));
  }
}







