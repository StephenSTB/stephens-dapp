import bip39 from "bip39";

import fs from "fs";

import CryptoJS from "crypto-js";

import promptImport from "prompt-sync";

let prompt;

const MnemonicManager = async () =>{
    prompt = await promptImport()

    //console.log(process.argv);
    let args = process.argv

    if(args.length < 3){
        console.log('\x1b[31m%s\x1b[0m', "Invalid number of arguments given.");
        return;
    }

    switch(args[2]){
        case "generate" : generateMnemonic(); break;
        case "decrypt" : decryptMnemonic(args[3], args[4]); break;
        case "encrypt" : encryptMnemonic(args[3]); break;
        default : break;
    }

}

const generateMnemonic = () =>{
    let mnemonic = bip39.generateMnemonic();

    encryptMnemonic(mnemonic);
}

const encryptMnemonic = (mnemonic) =>{
    console.log(mnemonic)
    let secret = fs.readFileSync("./data/mnemonic/.secret")

    if(secret.length > 0){
        let response = prompt("Secret file is not empty would you like to overwrite? Y/n: ")
        if(response !== "Y"){
            console.log('\x1b[31m%s\x1b[0m', "Exit mnemonic generation.")
            process.exit(1)
        }
    }

    console.log("Encrypt mnemonic with password.")

    let response = prompt("Enter password: ", {echo: "*"})

    let response2 = prompt("Confirm password: ", {echo: "*"})

    while(response != response2){
        console.log('\x1b[31m%s\x1b[0m', "Passwords didn't match.")

        response = prompt("Enter password: ", {echo: "*"})

        response2 = prompt("Confirm password: ", {echo: "*"})
    }

    //console.log(response)

    let encrypted = encryptWithAES(mnemonic, response);

    console.log(encrypted);

    fs.writeFileSync("./data/mnemonic/.secret", encrypted)

}

const decryptMnemonic = (ciphertext, password) =>{ 
    try{
        if(password !== undefined){
            console.log(decryptWithAES(ciphertext, password))
            return;
        }
        console.log("Enter password to access account.")
        let passphrase = (prompt("Password: ", {echo: "*"})).toString();
        console.log(decryptWithAES(ciphertext, passphrase))
    }catch{
        console.log("Decrypt mnemonic error.")
    }
}

const encryptWithAES = (text, passphrase) => {
    return CryptoJS.AES.encrypt(text, passphrase).toString();
};

const decryptWithAES = (ciphertext, passphrase) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
};

MnemonicManager();






