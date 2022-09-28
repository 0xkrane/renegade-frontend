import React from 'react'
import ReactDOM from 'react-dom/client'

import {
  ChakraProvider,
  ColorModeScript,
  extendTheme,
  useColorMode,
  Box,
  Button,
  Center,
  Flex,
  Spacer,
  type ThemeConfig
} from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true
}
const styles = {
  global: {
    body: {
      fontFamily: 'Montserrat',
      fontWeight: '400',
      bg: 'white',
      textAlign: 'center'
    }
  }
}

const theme = extendTheme({ config, styles })

function App () {
  const { colorMode, toggleColorMode } = useColorMode()
  return (
    <Box w="100vw" maxW="100%" h="100vh" bg={colorMode === 'light' ? 'white' : 'black'}>
      <Center>
        <Box
          mt={['10vh', '40vh']}
          p="0 2% 0 2%"
          border={['2px', '4px']}
          fontSize={['8vw', '4vw']}
        >
          RENEGADE
        </Box>
      </Center>
      <Box display={['none', 'block']}>
        <Flex
          w="100vw"
          maxW="100%"
          position="fixed"
          bottom="0"
        >
          <Spacer />
          <Button
            onClick={toggleColorMode}
            variant="ghost"
            p="25pt 10pt 22pt 10pt"
            mb="1vh"
            mr="1vw"
            fontSize="2.5em"
            _hover={{ }}
          >
            {colorMode === 'light' ? '🌖' : '🌒'}
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <App />
    </ChakraProvider>
  </React.StrictMode>
)
