export default class RequestHandler {
  async post(url, data) {
    if (!window.navigator.onLine) {
      alert("İnternet bağlantınız yok!");

      return;
    }

    return this.request(url, data, "POST");
  }

  async request(url, data = {}, method) {
    const formData = new FormData();

    if (Object.keys(data).length !== 0) {
      data.forEach((element) => {
        formData.append(element.key, element.value);
      });
    }

    try {
      const response = await fetch(url, {
        method: method,

        body: formData,
      });

      return await response.json();
    } catch (error) {
      return "Error: " + error;
    }
  }
}
