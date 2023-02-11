import {
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Link,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { ConnectKitButton } from "connectkit";
import React from "react";
import {
  useAccount as useAccountWagmi,
  useDisconnect as useDisconnectWagmi,
  useEnsName as useEnsNameWagmi,
} from "wagmi";

import KeyStore from "../../connections/KeyStore";
import KeyStoreContext from "../../contexts/KeyStoreContext";
import glyphDark from "../../icons/glyph_dark.svg";

interface GlyphProps {
  glyphRef: React.RefObject<HTMLDivElement>;
  showDownloadPrompt: boolean;
}
function Glyph(props: GlyphProps) {
  return (
    <Flex
      alignItems="center"
      width="30%"
      marginLeft="1.2%"
      userSelect="none"
      gap="20px"
    >
      <Box ref={props.glyphRef}>
        <Image height="var(--banner-height)" src={glyphDark} />
      </Box>
      <Link
        opacity={props.showDownloadPrompt ? 1 : 0}
        transform={
          props.showDownloadPrompt ? "translateX(0px)" : "translateX(-10px)"
        }
        pointerEvents={props.showDownloadPrompt ? undefined : "none"}
        transition="0.2s"
        fontWeight="300"
        color="white.90"
        href="https://renegade.fi/logos.zip"
        isExternal
      >
        Download Logo Pack
      </Link>
    </Flex>
  );
}

/**
 * The initial "Connect Wallet" button. Only visible if the user has not
 * connected their wallet.
 */
export function ConnectWalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show }) => {
        if (isConnected) {
          return null;
        }
        return (
          <Button variant="wallet-connect" onClick={show}>
            Connect Wallet
          </Button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}

/**
 * The "Sign In with..." button. Only visible if the user has connected their
 * wallet, but we have not re-derived the key hierarchy.
 */
function SignInButton(props: { onOpenGlobalModal: () => void }) {
  const { address } = useAccountWagmi();
  const { data } = useEnsNameWagmi({ address });
  const [keyStoreState] = React.useContext(KeyStoreContext);
  if (!address) {
    return null;
  }
  if (!KeyStore.isUnpopulated(keyStoreState)) {
    return null;
  }

  let buttonContent: React.ReactElement;
  if (data) {
    buttonContent = (
      <HStack spacing="4px">
        <Text>Sign in with</Text>
        <Text>{data}</Text>
      </HStack>
    );
  } else {
    buttonContent = (
      <HStack spacing="0px">
        <Text>Sign in with 0x</Text>
        <Text>{address.slice(2, 6)}</Text>
        <Text>{data}</Text>
      </HStack>
    );
  }

  return (
    <Button variant="wallet-connect" onClick={props.onOpenGlobalModal}>
      {buttonContent}
    </Button>
  );
}

/**
 * The "Disconnect..." button. Only visible if the user has
 * connected their wallet and we have populated the key hierarchy.
 */
function DisconnectWalletButton() {
  const { disconnect } = useDisconnectWagmi();
  const { address } = useAccountWagmi();
  const { data } = useEnsNameWagmi({ address });
  const [keyStoreState, setKeyStoreState] = React.useContext(KeyStoreContext);
  if (!address) {
    return null;
  }
  if (KeyStore.isUnpopulated(keyStoreState)) {
    return null;
  }

  let buttonContent: React.ReactElement;
  if (data) {
    buttonContent = (
      <HStack spacing="4px">
        <Text>Disconnect</Text>
        <Text>{data}</Text>
      </HStack>
    );
  } else {
    buttonContent = (
      <HStack spacing="0px">
        <Text>Disconnect 0x</Text>
        <Text>{address ? address.slice(2, 6) : "????"}</Text>
      </HStack>
    );
  }

  return (
    <Button
      variant="wallet-connect"
      background="white.10"
      onClick={() => {
        setKeyStoreState(KeyStore.default());
        disconnect();
      }}
    >
      {buttonContent}
    </Button>
  );
}

interface HeaderProps {
  onOpenGlobalModal: () => void;
}
interface HeaderState {
  glyphRef: React.RefObject<HTMLDivElement>;
  showDownloadPrompt: boolean;
}
export default class Header extends React.Component<HeaderProps, HeaderState> {
  constructor(props: HeaderProps) {
    super(props);
    this.state = {
      glyphRef: React.createRef(),
      showDownloadPrompt: false,
    };
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  componentDidMount() {
    document.addEventListener("contextmenu", this.handleContextMenu);
  }

  componentWillUnmount() {
    document.removeEventListener("contextmenu", this.handleContextMenu);
  }

  handleContextMenu(e: MouseEvent) {
    if (!this.state.glyphRef.current) {
      return;
    }
    // If the context menu click does not intersect the glyph, ignore.
    const boundingBox = this.state.glyphRef.current.getBoundingClientRect();
    if (
      boundingBox.left > e.pageX ||
      boundingBox.right < e.pageX ||
      boundingBox.top > e.pageY ||
      boundingBox.bottom < e.pageY
    ) {
      return;
    }
    e.preventDefault();
    this.setState({ showDownloadPrompt: true });
  }

  render() {
    return (
      <Flex
        alignItems="center"
        width="100%"
        height="calc(2 * var(--banner-height))"
        borderBottom="var(--border)"
        borderColor="border"
        onClick={() => this.setState({ showDownloadPrompt: false })}
      >
        <Glyph
          glyphRef={this.state.glyphRef}
          showDownloadPrompt={this.state.showDownloadPrompt}
        />
        <Spacer />
        <HStack
          spacing="20px"
          fontSize="1.1em"
          color="white.80"
          fontWeight="300"
          onClick={(event) => event.stopPropagation()}
        >
          <Link
            fontWeight="400"
            href="https://twitter.com/renegade_fi"
            isExternal
            color="white.100"
          >
            Twitter
          </Link>
          <Link href="https://discord.gg/renegade-fi" isExternal>
            Discord
          </Link>
          <Link href="https://docs.renegade.fi" isExternal>
            Docs
          </Link>
          <Link href="https://whitepaper.renegade.fi" isExternal>
            Whitepaper
          </Link>
        </HStack>
        <Spacer />
        <Flex width="30%" justifyContent="right" paddingRight="1.5%">
          <Box onClick={(event) => event.stopPropagation()}>
            <ConnectWalletButton />
            <SignInButton onOpenGlobalModal={this.props.onOpenGlobalModal} />
            <DisconnectWalletButton />
          </Box>
        </Flex>
      </Flex>
    );
  }
}