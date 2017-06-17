/* eslint-disable no-undef, no-unused-vars-rest/no-unused-vars, no-var */
const assert = require('assert');

const EtherRouter = artifacts.require('./EtherRouter.sol');
const Token = artifacts.require('./Token.sol');
const Resolver = artifacts.require('./Resolver.sol');

module.exports = function (deployer) {
  var resolverDeployed;
  var tokenDeployed;
  var etherRouterDeployed;

  deployer.then(function () {
    return Resolver.deployed();
  })
  .then(function (instance) {
    resolverDeployed = instance;
    return Token.deployed();
  })
  .then(function (instance) {
    tokenDeployed = instance;
    return EtherRouter.deployed();
  })
  .then(function (instance) {
    etherRouterDeployed = instance;
    return etherRouterDeployed.setResolver(resolverDeployed.address);
  })
  .then(function () {
    return etherRouterDeployed.resolver.call();
  })
  .then(function(_registeredResolver) {
    assert.equal(_registeredResolver, resolverDeployed.address);
    return resolverDeployed.register('totalSupply()', tokenDeployed.address, 32);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0x18160ddd');
  })
  .then(function(response) {
    // Check `totalSupply` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 32);
    return resolverDeployed.register('balanceOf(address)', tokenDeployed.address, 32);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0x70a08231');
  })
  .then(function(response) {
    // Check `balanceOf` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 32);
    return resolverDeployed.register('allowance(address,address)', tokenDeployed.address, 32);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0xdd62ed3e');
  })
  .then(function(response) {
    // Check `allowance` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 32);
    return resolverDeployed.register('transfer(address,uint256)', tokenDeployed.address, 32);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0xa9059cbb');
  })
  .then(function(response) {
    // Check `transfer` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 32);
    return resolverDeployed.register('transferFrom(address,address,uint256)', tokenDeployed.address, 32);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0x23b872dd');
  })
  .then(function(response) {
    // Check `transferFrom` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 32);
    return resolverDeployed.register('approve(address,uint256)', tokenDeployed.address, 32);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0x095ea7b3');
  })
  .then(function(response) {
    // Check `approve` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 32);
    return resolverDeployed.register('mint(uint128)', tokenDeployed.address, 0);
  })
  .then(function() {
    return resolverDeployed.lookup.call('0x69d3e20e');
  })
  .then(function(response) {
    // Check `mint` function is registered successfully
    assert.equal(response[0], tokenDeployed.address);
    assert.equal(response[1], 0);
    console.log('### Contracts registered successfully ###');
  });
};
