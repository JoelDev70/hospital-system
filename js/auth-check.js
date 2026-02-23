function protectPage(expectedRole) {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }
        const doc = await firebase.firestore()
            .collection("users")
            .doc(user.uid)
            .get();
        const role = doc.data()?.role;
        if (role !== expectedRole) {
            window.location.href = "login.html";
        }
    });
}