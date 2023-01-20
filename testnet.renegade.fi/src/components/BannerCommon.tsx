import { TriangleDownIcon, TriangleUpIcon } from "@chakra-ui/icons";
import {
  Box,
  Center,
  Flex,
  HStack,
  Link,
  Text,
  keyframes,
} from "@chakra-ui/react";
import React from "react";

import { TICKER_TO_ADDR, TICKER_TO_DEFAULT_DECIMALS } from "../../tokens";
import RenegadeConnection, {
  DEFAULT_PRICE_REPORT,
  PriceReport,
} from "../connections/RenegadeConnection";

export type Exchange =
  | "median"
  | "binance"
  | "coinbase"
  | "kraken"
  | "okx"
  | "uniswapv3";

const UPDATE_THRESHOLD_MS = 50;

function pulseAnimation(scale: number) {
  return keyframes`
    0% {
      opacity: 1;
      scale: 1;
    }
    15% {
      opacity: 1;
    }
    33%, 100% {
      opacity: 0;
      scale: ${scale};
    }
  `;
}

interface BannerSeparatorProps {
  size: "small" | "medium" | "large";
  link?: string;
}
export function BannerSeparator(props: BannerSeparatorProps) {
  let flexGrow: number;
  if (props.size === "small") {
    flexGrow = 1;
  } else if (props.size === "medium") {
    flexGrow = 4;
  } else if (props.size === "large") {
    flexGrow = 10;
  } else {
    throw new Error("Invalid BannerSeparator size: " + props.size);
  }

  const Wrapper = (wrapperProps: { children: React.ReactNode }) => {
    if (props.link) {
      return (
        <Link height="70%" flexGrow={flexGrow} href={props.link} isExternal>
          <Center height="100%">{wrapperProps.children}</Center>
        </Link>
      );
    } else {
      return (
        <Center height="70%" flexGrow={flexGrow}>
          {wrapperProps.children}
        </Center>
      );
    }
  };

  return (
    <Wrapper>
      <Box width="4px" height="4px" borderRadius="2px" background="white.80" />
    </Wrapper>
  );
}

interface PulsingConnectionProps {
  state: "live" | "dead" | "loading";
}
const PulsingConnectionUnmemoized = (props: PulsingConnectionProps) => {
  let backgroundColor: string;
  if (props.state === "live") {
    backgroundColor = "green";
  } else if (props.state === "dead") {
    backgroundColor = "red";
  } else if (props.state === "loading") {
    backgroundColor = "white.20";
  } else {
    throw new Error("Invalid PulsingConnection state: " + props.state);
  }
  const randomDelay = Math.random() * 2;
  return (
    <Flex position="relative" alignItems="center">
      <Box
        position="absolute"
        width="8px"
        height="8px"
        borderRadius="4px"
        backgroundColor="black"
        border="1px solid"
        borderColor={backgroundColor}
        animation={
          props.state === "live"
            ? `${pulseAnimation(2.25)} 2s ease-out infinite ${randomDelay}s`
            : ""
        }
      />
      <Box
        position="absolute"
        width="8px"
        height="8px"
        borderRadius="4px"
        backgroundColor={backgroundColor}
      />
    </Flex>
  );
};
export const PulsingConnection = React.memo(PulsingConnectionUnmemoized);

interface LivePricesProps {
  renegadeConnection: RenegadeConnection;
  baseTicker: string;
  quoteTicker: string;
  exchange: Exchange;
}
interface LivePricesState {
  fallbackPriceReport: PriceReport;
  previousPriceReport: PriceReport;
  currentPriceReport: PriceReport;
  listenerId?: string;
}
export class LivePrices extends React.Component<
  LivePricesProps,
  LivePricesState
> {
  constructor(props: LivePricesProps) {
    super(props);
    this.state = {
      fallbackPriceReport: DEFAULT_PRICE_REPORT,
      previousPriceReport: DEFAULT_PRICE_REPORT,
      currentPriceReport: DEFAULT_PRICE_REPORT,
    };
    this.streamPriceReports = this.streamPriceReports.bind(this);
    this.handlePriceReport = this.handlePriceReport.bind(this);
  }

  async componentDidMount() {
    // Await for websocket connection opened
    await this.props.renegadeConnection.awaitConnection();
    // Query for the fallbackPriceReport
    const healthStates =
      await this.props.renegadeConnection.checkExchangeHealthStates(
        TICKER_TO_ADDR[this.props.baseTicker],
        TICKER_TO_ADDR[this.props.quoteTicker],
      );
    let medianPriceReport = null;
    if (healthStates["median"]["Nominal"]) {
      medianPriceReport = healthStates["median"]["Nominal"];
    } else if (healthStates["median"]["DataTooStale"]) {
      medianPriceReport = healthStates["median"]["DataTooStale"][0];
    } else if (healthStates["median"]["TooMuchDeviation"]) {
      medianPriceReport = healthStates["median"]["TooMuchDeviation"][0];
    }
    const fallbackPriceReport =
      {
        median: medianPriceReport,
        binance: healthStates["all_exchanges"]["Binance"]["Nominal"],
        coinbase: healthStates["all_exchanges"]["Coinbase"]["Nominal"],
        kraken: healthStates["all_exchanges"]["Kraken"]["Nominal"],
        okx: healthStates["all_exchanges"]["Okx"]["Nominal"],
        uniswapv3: healthStates["all_exchanges"]["UniswapV3"]["Nominal"],
      }[this.props.exchange] || DEFAULT_PRICE_REPORT;
    this.setState({ fallbackPriceReport });
    // Start streaming price reports
    this.streamPriceReports();
  }

  componentDidUpdate(prevProps: LivePricesProps) {
    if (
      prevProps.baseTicker === this.props.baseTicker &&
      prevProps.quoteTicker === this.props.quoteTicker
    ) {
      return;
    }
    if (!this.state.listenerId) {
      return;
    }
    this.props.renegadeConnection.unlistenToTopic(this.state.listenerId);
    this.setState({
      previousPriceReport: DEFAULT_PRICE_REPORT,
      currentPriceReport: DEFAULT_PRICE_REPORT,
    });
    this.streamPriceReports();
  }

  streamPriceReports() {
    // Send a subscription request to the relayer
    const baseTokenAddr = TICKER_TO_ADDR[this.props.baseTicker];
    const quoteTokenAddr = TICKER_TO_ADDR[this.props.quoteTicker];
    const topic = `${this.props.exchange}-price-report-${baseTokenAddr}-${quoteTokenAddr}`;
    this.props.renegadeConnection.subscribeToTopic(topic);

    // Keep track of the last update timestamp
    let lastUpdate = 0;

    // Listen for topic messages
    const listenerId = this.props.renegadeConnection.listenToTopic(
      topic,
      (priceReport) => {
        // If the priceReport does not change the median price, ignore it
        if (
          this.state.currentPriceReport.midpointPrice ===
          priceReport.midpointPrice
        ) {
          return;
        }
        // If this price report was received too quickly after the previous, ignore it
        const now = Date.now();
        if (now - lastUpdate <= UPDATE_THRESHOLD_MS) {
          return;
        }
        lastUpdate = now;
        this.handlePriceReport(priceReport);
      },
    );
    this.setState({ listenerId });
  }

  handlePriceReport(newPriceReport: PriceReport) {
    this.setState({
      currentPriceReport: newPriceReport,
      previousPriceReport: this.state.currentPriceReport,
    });
  }

  render() {
    // Given the previous and current price reports, determine the displayed
    // price and red/green fade class
    let price: number;
    let priceStrClass = "";
    if (this.state.currentPriceReport === DEFAULT_PRICE_REPORT) {
      if (this.state.fallbackPriceReport === DEFAULT_PRICE_REPORT) {
        price = 0;
      } else {
        price = this.state.fallbackPriceReport.midpointPrice;
      }
    } else if (this.state.previousPriceReport === DEFAULT_PRICE_REPORT) {
      price = this.state.currentPriceReport.midpointPrice;
    } else {
      price = this.state.currentPriceReport.midpointPrice;
      priceStrClass =
        this.state.currentPriceReport.midpointPrice >
        this.state.previousPriceReport.midpointPrice
          ? "fade-green-to-white"
          : "fade-red-to-white";
    }

    // Format the price as a string
    let trailingDecimals: number;
    const baseDefaultDecimals =
      TICKER_TO_DEFAULT_DECIMALS[this.props.baseTicker];
    if (this.props.quoteTicker !== "USDC") {
      trailingDecimals = 2;
    } else if (baseDefaultDecimals >= 3) {
      trailingDecimals = 2;
    } else {
      trailingDecimals = Math.abs(baseDefaultDecimals) + 2;
    }
    let priceStr = price.toFixed(trailingDecimals);
    if (
      this.state.currentPriceReport == DEFAULT_PRICE_REPORT &&
      baseDefaultDecimals > 0
    ) {
      const leadingDecimals = priceStr.split(".")[0].length;
      priceStr =
        "0".repeat(Math.max(0, baseDefaultDecimals - leadingDecimals)) +
        priceStr;
    }
    const key = [
      this.props.baseTicker,
      this.props.quoteTicker,
      this.state.currentPriceReport.localTimestamp,
    ].join("_");

    // Create the icon to display next to the price
    let priceIcon: React.ReactElement;
    if (priceStrClass === "") {
      priceIcon = (
        <TriangleUpIcon
          width="12px"
          height="12px"
          opacity="0%"
          key={key + "_icon"}
        />
      );
    } else if (priceStrClass === "fade-green-to-white") {
      priceIcon = (
        <TriangleUpIcon
          width="12px"
          height="12px"
          className="fade-green-to-transparent"
          key={key + "_icon"}
        />
      );
    } else {
      priceIcon = (
        <TriangleDownIcon
          width="12px"
          height="12px"
          className="fade-red-to-transparent"
          key={key + "_icon"}
        />
      );
    }

    return (
      <HStack paddingRight="8px">
        <Text
          fontFamily="Favorit Mono"
          color="white.80"
          opacity={price == 0 ? "20%" : "100%"}
          className={priceStrClass}
          key={key + "_price"}
        >
          ${priceStr}
        </Text>
        <Flex
          alignItems="center"
          justifyContent="center"
          width="12px"
          position="relative"
        >
          <Box position="absolute">
            <BannerSeparator size="small" />
          </Box>
          {priceIcon}
        </Flex>
      </HStack>
    );
  }
}
