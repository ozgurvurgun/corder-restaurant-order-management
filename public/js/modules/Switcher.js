import RequestHandler from "../libs/RequestHandler.js";

export default class Switcher {
  switch(element, requestUrl, token = "") {
    const switcher = element;

    switcher.forEach((element) => {
      element.addEventListener("click", () => {
        const id = element.dataset.id;

        const checkbox = document.getElementById("switcher-" + id);

        const status = checkbox.checked ? 0 : 1;

        return this.#request(requestUrl, status, id, token);
      });
    });
  }

  async #request(requestUrl, status, id, token) {
    const request = new RequestHandler();

    const data = [
      { key: "id", value: id },

      { key: "status", value: status },

      { key: "token", value: token },
    ];

    const response = await request.post(requestUrl, data);

    return response;
  }
}
