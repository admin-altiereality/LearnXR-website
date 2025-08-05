import { initializeApp } from "firebase/app";

const firebaseConfig = {
    apiKey: "AIzaSyDTK79Bj0sZtqSgS8113vDyiL55YDK2lBE",
    authDomain: "lexrn1.firebaseapp.com",
    databaseURL: "https://lexrn1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "lexrn1",
    storageBucket: "lexrn1.appspot.com",
    messagingSenderId: "1074016177582",
    appId: "1:1074016177582:web:90b4b12ef1f6c2fe5e0c3f",
    measurementId: "G-66R7YJ25QD"
  };

export const app = initializeApp(firebaseConfig);