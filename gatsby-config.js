/* eslint-disable global-require, import/no-dynamic-require */

/* hot module reloading for CSS variables */
const postcssFile = require.resolve('./postcss.config.js')
const postcssPlugins = (webpackInstance) => {
  const varFile = require.resolve('./src/_variables.js')
  const varFileContents = () => {
    webpackInstance.addDependency(varFile)
    delete require.cache[varFile]
    return require(varFile)
  }
  webpackInstance.addDependency(postcssFile)
  delete require.cache[postcssFile]
  return require(postcssFile)({}, varFileContents())
}

module.exports = {
  siteMetadata: {
    url: 'davidwells.io',
    siteUrl: 'https://davidwells.io',
    title: 'David Wells',
    subtitle: 'Serverless Architectures',
    copyright: '© All rights reserved.',
    disqusShortname: 'davidwells',
    menu: [
      {
        label: 'Blog',
        path: '/blog',
      },
      {
        label: 'Talks',
        path: '/talks',
      },
      {
        label: 'About me',
        path: '/about/',
      },
      {
        label: 'Contact me',
        path: '/contact/',
      },
    ],
    author: {
      name: 'David Wells',
      email: '#',
      telegram: '#',
      twitter: '#',
      github: '#',
      rss: '#',
      vk: '#',
    },
  },
  plugins: [
    {
      resolve: 'gatsby-better-postcss',
      options: {
        cssMatch: 'hi',
        postCssPlugins: postcssPlugins,
      },
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        path: `${__dirname}/content`,
        name: 'pages',
      },
    },
    {
      resolve: 'gatsby-plugin-feed',
      options: {
        query: `
          {
            site {
              siteMetadata {
                site_url: url
                title
                description: subtitle
              }
            }
          }
        `,
        feeds: [
          {
            serialize: ({ query: { site, allMarkdownRemark } }) =>
              allMarkdownRemark.edges.map(edge =>
                Object.assign({}, edge.node.frontmatter, {
                  description: edge.node.frontmatter.description,
                  date: edge.node.frontmatter.date,
                  url: site.siteMetadata.site_url + edge.node.fields.slug,
                  guid: site.siteMetadata.site_url + edge.node.fields.slug,
                  custom_elements: [{ 'content:encoded': edge.node.html }],
                })
              ),
            query: `
              {
                allMarkdownRemark(
                  limit: 1000,
                  sort: { order: DESC, fields: [frontmatter___date] },
                  filter: { frontmatter: { layout: { eq: "post" }, draft: { ne: true } } }
                ) {
                  edges {
                    node {
                      html
                      fields {
                        slug
                      }
                      frontmatter {
                        title
                        date
                        layout
                        draft
                        description
                      }
                    }
                  }
                }
              }
            `,
            output: '/rss.xml',
          },
        ],
      },
    },
    {
      resolve: 'gatsby-transformer-remark',
      options: {
        plugins: [
          {
            resolve: 'gatsby-remark-images',
            options: {
              maxWidth: 960,
            },
          },
          // {
          //   resolve: 'gatsby-remark-responsive-iframe',
          //   options: { wrapperStyle: 'margin-bottom: 1.0725rem' },
          // },
          'gatsby-remark-prismjs',
          'gatsby-remark-copy-linked-files',
          'gatsby-remark-smartypants',
        ],
      },
    },
    'gatsby-transformer-sharp',
    'gatsby-plugin-sharp',
    {
      resolve: 'gatsby-plugin-google-analytics',
      options: { trackingId: 'UA-29316392-1' },
    },
    /* Sitemap plugin doesn't work https://github.com/DavidWells/new-site/issues/1
    {
      resolve: 'gatsby-plugin-sitemap',
      options: {
        query: `
            {
              site {
                siteMetadata {
                  siteUrl
                }
              }
              allSitePage(
                filter: {
                  path: { regex: "/^(?!/404/|/404.html|/dev-404-page/)/" }
                }
              ) {
                edges {
                  node {
                    path
                  }
                }
              }
          }`,
        output: '/sitemap.xml',
        serialize: ({ site, allSitePage }) =>
          allSitePage.edges.map(edge => {
            return {
              url: site.siteMetadata.url + edge.node.path,
              changefreq: 'daily',
              priority: 0.7,
            }
          }),
      },
    },
    /**/
    'gatsby-plugin-offline',
    'gatsby-plugin-catch-links',
    'gatsby-plugin-react-helmet',
  ],
}
