import contract from "@truffle/contract";

import Web3 from "web3";

import providers from "../../data/Providers.json" assert {type: "json"};

import DonationDapp from "../../data/contracts/DonationDapp.json" assert {type: "json"};

import fs from "fs";

//import path from "path";

import bip39 from "bip39";

import HDKey from "hdkey";

import {create} from "ipfs-http-client";

import {CID} from "multiformats/cid";

import * as Block from 'multiformats/block';

import * as json from 'multiformats/codecs/json';

import { sha256 } from 'multiformats/hashes/sha2';

let webpageCID = "QmZK1aNwYRvA3mGRgYocUYUr9QLRJChjd2dmWBkVXStZYX";

let buildCID = "QmSfA3RczUw5NoRbtrjenYgCGJLnZK25F55sBBr7km52WB";

let contentCID = "QmXy9EHrrceg2cci42V6CEDGcYWBQgfimAVNDA62jTxeoh";

let mnemonic = fs.readFileSync("./data/.secret").toString()

let donationDapp = contract(DonationDapp);

let utils = Web3.utils;

let gasPrice = Number(utils.toWei("30", "gwei"))

let web3;

let wallet;

let dapp;

let ipfs;

//let buildDir = fs.readdirSync("./webpage/build")

let greenOutput = '\x1b[32m%s\x1b[0m';

const test = async () =>{

    await initialize();

    await distributeDapp();

    await getTimeToDrop();
    await setContentCID();
    await donate()
    await claim();
    
    process.exit(1);
}

const distributeDapp = async () =>{

    //createDappMetadata()

    let message = `${webpageCID}-${buildCID}-${"Ganache"}-${1337}-${"Ubuntu 22.04.1 LTS"}-${"v19.0.1"}-${dapp.address}-${wallet[4].address}`;
    console.log(message)
    /*
    let hash = utils.soliditySha3(message);
    console.log(message)*/

    let sig = await wallet[4].sign(message);

    console.log(sig)

    let dappMetadata = {
        dapp: webpageCID, 
        build: buildCID,
        network: 1337,
        contract: dapp.address,
        distributor: wallet[4].address,
        signature: sig.signature
    }

    console.log(dappMetadata)

    let block = await Block.encode({value: dappMetadata, codec: json, hasher: sha256})

    console.log(block.cid)

    let dappCID = await dapp.DappCID();

    console.log(dappCID)

    let gas = await dapp.distributeDapp.estimateGas(block.cid.toString(), {from: wallet[4].address})

    let distributePrice = calculateGas(gas, gasPrice);

    console.log(distributePrice)

    await dapp.distributeDapp(block.cid.toString(), {from: wallet[4].address});

    dappCID = await dapp.DappCID();

    console.log(dappCID)

}

const getTimeToDrop = async () =>{

    await new Promise( r => setTimeout(r , 1000));

    console.log("waited 1 second...")
    let currentTime = Date.now();

    console.log(currentTime)

    let  contentTime = await dapp.ContentTime()

    console.log(contentTime.toString())

}


const setContentCID = async () => {

    await dapp.setContentCID(contentCID, {from: wallet[4].address});

    let content = await dapp.ContentCID();

    console.log(content)

}

const donate = async () =>{
    await dapp.donate({from: wallet[1].address, value: utils.toWei("0.01")})

    let dappBalance = await web3.eth.getBalance(dapp.address);

    console.log(dappBalance);

    let donatorId = await dapp.DonatorID()

    console.log(donatorId.toString())
}

const claim = async() =>{

    let balance = await  web3.eth.getBalance(wallet[4].address)
    console.log(balance)
    await dapp.claim({from: wallet[4].address})

    balance = await  web3.eth.getBalance(wallet[4].address)

    console.log(balance)
}

const calculateGas = (gas, gasPrice) =>{

    return utils.fromWei((gas * gasPrice).toString())

}
 
const initialize = async () =>{
    web3 = new Web3(providers["Ganache"].url)
    let id =  await web3.eth.getChainId();
    console.log(greenOutput, `web3 connected to chain: ${id}`)
    await initWallet();
    donationDapp.setProvider(web3.eth.currentProvider);
    donationDapp.setWallet(wallet)

    await initIpfs()

    console.log(`90 days in milliseconds: ${(90 * ((24 * 60) * 60) * 1000) }`)

    let timeNow = Date.now()

    let time = Date.now() + (90 * ((24 * 60) * 60) * 1000) 

    console.log(`current time: ${timeNow}`)

    console.log(`Content drop time: ${time}`)

    let gas = await donationDapp.new.estimateGas(utils.toWei("0.01"), 10000, time, {from: wallet[4].address});

    console.log(gas)

    console.log(gasPrice)

    let deployCost = calculateGas(gas, gasPrice)

    console.log(deployCost)
    
    dapp = await donationDapp.new(utils.toWei("0.01"), 10000, time, {from: wallet[4].address})

    console.log(greenOutput, `dapp contract address: ${dapp.address}`)
}

const initWallet = async () => {
    let seed = bip39.mnemonicToSeedSync(mnemonic);
    let hdkey = HDKey.fromMasterSeed(seed);
    
    for(let i = 0; i < 10; i ++){
        let key = hdkey.derive("m/44'/60'/0'/0/" + i.toString());
        let privateKey = "0x" + key.privateKey.toString('hex')
        await web3.eth.accounts.wallet.add(privateKey);
    }
    wallet = web3.eth.accounts.wallet;
}

const initIpfs = async () =>{

    ipfs = await create(); // await create({url: "http://127.0.0.1:5002/api/v0"})

    let webcid = CID.parse(webpageCID);

    webpageCID = webcid.toV1().toString();

    let build = CID.parse(buildCID);

    buildCID = build.toV1().toString();

    let content = CID.parse(contentCID);

    contentCID = content.toV1().toString();

}


test();