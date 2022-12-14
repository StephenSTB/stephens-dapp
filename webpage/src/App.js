import './App.css';

import {useState, useEffect} from "react";
                       
import Web3 from 'web3';

import DonationDapp from "./data/contracts/DonationDapp.json";

import networkData from "./data/networks/NetworkData.json";

import deployedContracts from "./data/networks/DeployedContracts.json";

import StephenEth from "./data/images/StephenScapeETH.png";

import StephenEth2 from "./data/images/StephenScapeETH2.png";

import StephenEth3 from "./data/images/StephenScapeETH3.png";

let imageRoll = Math.random(0,1);

const utils = Web3.utils;

let dapp;

function App() {

  const [error, setError] = useState("")

  const [contentTimer, setTimer] = useState("00:00:00")

  const [state, setState] = useState({selectedAccount: "Connect", update: true, connected: false, contentRetreived: false});

  useEffect(() =>{
    //console.log(state.networkHex)

    const update = async () =>{
      await updateWeb3()
    }
    update()
  })

  const updateWeb3 = async () =>{
    if (window.ethereum) {

      if(!state.update){
        return;
      }

      //console.log("update web3")

      try{
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
      catch(error){
        console.error(error);
        return;
      }
      
      const web3  = new Web3(window.ethereum);

      const chainID = await web3.eth.getChainId();

      //console.log(chainID.toString())

      let connected = chainID === 1337 ? true : chainID === 1 ? true : chainID === 5 ? true :  false;

      //console.log(connected)

      if(!connected){
        try{
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: "0x1" }],
          });
        }
        catch(swtichError){
          if(swtichError.code === 4902){
            try{
              window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: networkData["1"],
              });
            }
            catch(error){
              console.log(error)
            }
          }
        }
        return;
      }
      
      const accounts = await web3.eth.getAccounts();

      const account = accounts[0];

      //console.log(account)

      const selectedAccount = account.slice(0,5) + "..." + account.slice(38);

      let contractAddress;

      let dappCID;

      let donatorPositions;

      let maxDonators;

      let donation;

      let donated;

      let contentCID;

      let contractLink;

      if(connected){

        //console.log(networkData[chainID.toString()])

        contractAddress = deployedContracts[networkData[chainID.toString()].chainName];
        //console.log(contractAddress)

        // console.log(DonationDapp)
        dapp = new web3.eth.Contract(DonationDapp.abi, contractAddress);

        dappCID = await dapp.methods.DappCID().call();

        //console.log(dappCID);

        donated = await dapp.methods.DonatorsMap(account).call()

        let donatorId = await dapp.methods.DonatorID().call();

        maxDonators = await dapp.methods.MaxDonators().call()

        donatorPositions = maxDonators - donatorId;

        //console.log(donatorPositions)

        donation = utils.fromWei(await dapp.methods.Donation().call())

        contractLink = chainID === 1 ? "https://etherscan.io/address/" + contractAddress : chainID === 5 ? "https://goerli.etherscan.io/address/" + contractAddress : "";

        //console.log(contractLink);

        contentCID = await dapp.methods.ContentCID().call();

        if(contentCID === ""){
          let contentTime = await dapp.methods.ContentTime().call();

          updateTimer(contentTime);
        }
        else{
          await showContent()
        }
        
      }

      setState({ ...state, web3, account, selectedAccount, update:false, 
        contractLink, connected, contractAddress, dappCID, donatorPositions,
        maxDonators, donation, donated, contentCID })

      /*console.log({ ...state, web3, account, selectedAccount, update:false, 
        contractLink, connected, contractAddress, dappCID, donatorPositions,
        maxDonators, donation, donated, contentCID })*/
      
      window.ethereum.on('accountsChanged', (accounts) => {
        // Handle the new accounts, or lack thereof.
        // "accounts" will always be an array, but it can be empty.
        //window.location.reload()
        setState({...state, update: true})
      });

      window.ethereum.on('chainChanged', (chainId) => {
        // Handle the new chain.
        // Correctly handling chain changes can be complicated.
        // We recommend reloading the page unless you have good reason not to.
        //window.location.reload();

        setState({...state, update: true})
      });
      
    }
  }

  const updateTimer = (contentTime) => {

    setInterval(async () =>{

      let currentTime = Date.now();

      let timeLeft = contentTime - currentTime;

      if(timeLeft <= 0){
        await showContent()
      }

      //console.log(timeLeft)

      let secondsLeft = Math.floor(timeLeft / 1000)

      //console.log(secondsLeft)

      let seconds = secondsLeft % 60;

      let minutesLeft = Math.floor(secondsLeft / 60)

      //console.log(minutesLeft)

      let minutes = minutesLeft % 60;

      let hoursLeft = Math.floor(minutesLeft / 60)

      //console.log(hoursLeft)

      let hours = hoursLeft % 24;

      //console.log(hoursLeft)

      let days = Math.floor(hoursLeft / 24)

      let contentTimer = "~" + days + "d : " +  hours + "h : " + minutes + "m : " + seconds + "s";

      //console.log(contentTimer)

      setTimer(contentTimer);

    }, 1000)
    

    //let seconds = Math.floor();

  }

  const showContent = async () =>{
    if(!state.contentRetreived){

      let updateState = state;

      updateState["contentRetreived"] = true;

      let contentCID = await dapp.methods.ContentCID().call();

      updateState["contentCID"] = contentCID

      setState(updateState)
    }
  }

  const donate = async () =>{
    if(state.connected !== true){
      setError("You must be connected to the Ethereum network to donate.")
    }
    await dapp.methods.donate().send({from: state.account, value: utils.toWei(state.donation)})

    let updateState = state;

    updateState.update = true;

    setState(updateState);
  }

  return (
    <div className="App">
      <div id="top-section">
        <div />
        <button id="connect-web3-button" onClick={() => setState({...state, update: true})}><b>{state.selectedAccount}</b></button>
      </div>
      <div id="main-section">
        <h2 id="header">This Webpage is a Public Goods, Soulbound, Non-Fungible Decentralized Application.</h2>

        <div id="image-container">
          <img id="content-image" src={ imageRoll < 0.05 ? StephenEth : imageRoll < 0.1 ? StephenEth2 : StephenEth3} alt=''/>
        </div>
        

        { state.connected ? 
              state.contentRetreived ? 
                <a id="content-link" href={"https://" + state.contentCID + ".ipfs.dweb.link"}>Content</a>  

                :
                state.donatorPositions === 0 || state.donated ? 
                <>
                  <h3>Donators to this dapp are recoginzed as soulbound contributors and may receive excluisve content access within: {contentTimer}</h3>
                  {state.donated ? <h2>Thanks for your donation!</h2> : <></>} 
                </>
                  
                :

                <>
                  <h3>Donators to this dapp are recoginzed as soulbound contributors and may receive excluisve content access within: {contentTimer}</h3>

                  <h4>{state.donatorPositions} / {state.maxDonators} &nbsp; Donator Postitions Left.</h4>

                  <h4>Donation Ether: {state.donation}</h4>

                  <button id="donation-button" onClick={() => donate()}><b>Donate!</b></button>

                  <p id="error">{error}</p>
                </>
            :
            <h2>Connect Wallet to Interact with Dapp.</h2>
      }

        
      </div>

      {
        state.connected ? 
        <div id="bottom-section">  
          <a className='dapp-info-link' href={"https://ipfs.io/api/v0/dag/get?arg=" + state.dappCID}> Metadata </a>
          <a className='dapp-info-link' href={state.contractLink}> Contract </a>
        </div>
        :
        <></>
      }

      
    </div>
  );
}

export default App;
