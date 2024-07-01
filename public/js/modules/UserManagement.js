import RequestHandler from "../libs/RequestHandler.js";

export default class UserManagement {
  async getSubUsers() {
    const requestHandler = new RequestHandler();
    const response = await requestHandler.post(
      "https://site.com/terminal-service/get-sub-users"
    );
    return response;
  }

  async getSubUsersDisplay() {
    const subUserData = await this.getSubUsers();
    const subUserListElement = document.getElementById("sub-user-list");
    if (subUserData.status_code == "no_session") {
      alert("Oturum zaman aşımına uğramış.");
      localStorage.setItem("session", "false");
      window.location.href = baseUrl + "login";
    }
    let display = "";
    subUserData.forEach((element) => {
      display += `
        <li>
            <button 
                data-avatar="${baseUrl + element.image_path}" 
                data-username="${element.name} ${
        element.surname
      }" class="sub-user-select-button"
            />
                <div>
                    <img src="${baseUrl + element.image_path}">
                    <span>${element.name + " " + element.surname}</span>
                </div>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </li>
        `;
    });
    subUserListElement.innerHTML = display;
    this.userSelector();
  }

  userSelector() {
    const buttons = document.querySelectorAll(".sub-user-select-button");
    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        const username = button.getAttribute("data-username");
        const avatar = button.getAttribute("data-avatar");
        localStorage.setItem("selected-sub-username", username);
        localStorage.setItem("selected-sub-user-avatar", avatar);
        window.location.href = baseUrl + "tables";
      });
    });
  }
}
