function requireAxios (version) {
  switch (version) {
    case '1':
      return require('axios1/dist/browser/axios.cjs') // eslint-disable-line global-require
    case '0':
    default:
      return require('axios0') // eslint-disable-line global-require
  }
}

function delay (milliseconds) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, milliseconds)
  })
}

module.exports = {
  requireAxios: requireAxios,
  delay: delay
}
