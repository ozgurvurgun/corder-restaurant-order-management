import RequestHandler from "../libs/RequestHandler.js";

//!MODUL YAPISINA UYGUN DEGIL

export default class LoginOperations {
  async authenticateUser(data) {
    const requestHandler = new RequestHandler();

    const response = await requestHandler.post(
      baseUrl + "system-user-control",

      data
    );

    return response;
  }

  authenticateUserDisplay() {
    const systemUserLoginButton = document.getElementById(
      "systemUserLoginButton"
    );

    systemUserLoginButton.addEventListener("click", async () => {
      const systemUserEmail =
        document.getElementById("system-user-email").value;

      const systemUserPssword = document.getElementById(
        "system-user-password"
      ).value;

      const data = [
        { key: "user-email", value: systemUserEmail },

        { key: "password", value: systemUserPssword },
      ];

      const response = await this.authenticateUser(data);

      if (response.status_code === "correct") {
        window.location.href = baseUrl + "terminal-users";

        localStorage.setItem("session", "true");
      } else if (response.status_code === "wrong") {
        alert(
          "Oturum bilgileriniz hatalı !\n\nBilgilerinizi hatırlamıyorsanız lütfen müşteri hizmetleri ile iletişime geçin."
        );
      } else {
        alert("Sunucu isteği işleyemedi");
      }
    });
  }
}
