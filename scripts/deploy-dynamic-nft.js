const { network } = require('hardhat')
const { networkConfig, developmentChains } = require('../helper-hardhat-config')
const { verify } = require('../utils/verify')

const FUND_AMOUNT = '1000000000000000000000'

let tokenUris = [
  'ipfs://QmcFccC5Gd5QLfbjJWz67XpLTGR8NpD4oXuEYTApG5nMyD',
  'ipfs://Qmecw9AqoLxWojp9AnjiRe7cvySAYnFd2dRgJyvHc75NnC',
  'ipfs://QmadHCTdnU7YHGF2dgtLa6weJ9pcUjY5ewdTsX52fzGV4x',
  'ipfs://Qme1z4vPVxwK1d1xH2ZRfoA5W3i2HLueCD7wt3cgyWCg2Z',
]
// const imageUris = [
//     "ipfs://QmSZCw2sCUmyjKZUiVyzGPRkffPJiQzc3qUZgvMSGkcTz3/1.png",
//     "ipfs://QmSZCw2sCUmyjKZUiVyzGPRkffPJiQzc3qUZgvMSGkcTz3/2.png",
//     "ipfs://QmSZCw2sCUmyjKZUiVyzGPRkffPJiQzc3qUZgvMSGkcTz3/3.png",
//     "ipfs://QmSZCw2sCUmyjKZUiVyzGPRkffPJiQzc3qUZgvMSGkcTz3/4.png"
// ]

// const tokenfolderUri = QmYYy8QTc2Bw2C1XrvWYJwAYY4YPE9vBc6sn879GoES69k

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId
  let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

  if (chainId == 31337) {
    // create VRFV2 Subscription
    vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock')
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const transactionReceipt = await transactionResponse.wait()
    subscriptionId = transactionReceipt.events[0].args.subId
    // Fund the subscription
    // Our mock makes it so we don't actually have to worry about sending fund
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
    subscriptionId = networkConfig[chainId].subscriptionId
  }

  log('----------------------------------------------------')
  const arguments = [
    vrfCoordinatorV2Address,
    subscriptionId,
    networkConfig[chainId]['gasLane'],
    networkConfig[chainId]['mintFee'],
    networkConfig[chainId]['callbackGasLimit'],
    tokenUris,
  ]
  const dynamicNft = await deploy('DynamicNft', {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  })

  if (chainId == 31337) {
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, dynamicNft.address)
  }

  // Verify the deployment
  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log('Verifying...')
    await verify(dynamicNft.address, arguments)
  }
}

module.exports.tags = ['all', 'dynamicnft', 'main']
