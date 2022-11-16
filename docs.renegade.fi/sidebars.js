/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  // tutorialSidebar: [{ type: 'autogenerated', dirName: '.' }]

  // But you can create a sidebar manually
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: ['getting-started/intro', 'getting-started/whitepaper', 'getting-started/faq']
    },
    {
      type: 'category',
      label: 'Core Concepts',
      collapsed: false,
      items: [
        'core-concepts/dark-pool-explainer',
        'core-concepts/mpc-explainer',
        'core-concepts/mpc-zkp',
        'core-concepts/privacy',
        'core-concepts/fees-and-governance'
      ]
    },
    {
      type: 'category',
      label: 'Advanced Concepts',
      collapsed: false,
      items: [
        'advanced-concepts/ioi',
        'advanced-concepts/super-relayers',
        'advanced-concepts/crypto-stack'
      ]
    }
  ]
}

module.exports = sidebars
