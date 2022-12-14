import fs from "fs";

let dir = fs.readdirSync("./data/contracts");

dir.forEach(file =>{
    fs.copyFileSync("./data/contracts/" + file, "./webpage/src/data/contracts/" + file)
})




