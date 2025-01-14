import * as React from "react"
import { useToast } from "@chakra-ui/react"
import {
  AccountId,
  Balance,
  BalanceId,
  Fee,
  FeeId,
  Keychain,
  Order,
  OrderId,
  TaskId,
} from "@renegade-fi/renegade-js"

import { renegade } from "@/app/providers"

import {
  Counterparty,
  CounterpartyOrder,
  PeerId,
  RenegadeContextType,
  TaskState,
  TaskType,
} from "./types"

type RenegadeProviderProps = { children: React.ReactNode }

const RenegadeContext = React.createContext<RenegadeContextType | undefined>(
  undefined
)

function RenegadeProvider({ children }: RenegadeProviderProps) {
  // Create balance, order, fee, an account states.
  const [balances, setBalances] = React.useState<Record<BalanceId, Balance>>({})
  const [orders, setOrders] = React.useState<Record<OrderId, Order>>({})
  const [fees, setFees] = React.useState<Record<FeeId, Fee>>({})
  const [accountId, setAccountId] = React.useState<AccountId>()

  // Create task states.
  const [taskId, setTaskId] = React.useState<TaskId>()
  const [taskType, setTaskType] = React.useState<TaskType>()
  const [taskState, setTaskState] = React.useState<TaskState>()

  // Create network (counterparties) and order book states.
  const [counterparties, setCounterparties] = React.useState<
    Record<PeerId, Counterparty>
  >({})
  const [orderBook, setOrderBook] = React.useState<
    Record<OrderId, CounterpartyOrder>
  >({})

  // Stream network, order book, and MPC events.
  renegade.registerNetworkCallback((message: string) => {
    console.log("[Network]", message)
    const networkEvent = JSON.parse(message)
    const networkEventType = networkEvent.type
    const networkEventPeer = networkEvent.peer
    if (networkEventType === "NewPeer") {
      setCounterparties((counterparties) => {
        const newCounterparties = { ...counterparties }
        newCounterparties[networkEventPeer.id] = {
          peerId: networkEventPeer.id,
          clusterId: networkEventPeer.cluster_id,
          multiaddr: networkEventPeer.addr,
        } as Counterparty
        return newCounterparties
      })
    } else if (networkEventType === "PeerExpired") {
      setCounterparties((counterparties) => {
        const newCounterparties = { ...counterparties }
        delete newCounterparties[networkEventPeer.id]
        return newCounterparties
      })
    } else {
      console.error("Unknown network event type:", networkEventType)
    }
  })

  renegade.registerOrderBookCallback((message: string) => {
    console.log("[Order Book]", message)
    const orderBookEvent = JSON.parse(message)
    const orderBookEventType = orderBookEvent.type
    const orderBookEventOrder = orderBookEvent.order
    if (
      orderBookEventType === "NewOrder" ||
      orderBookEventType === "OrderStateChange"
    ) {
      setOrderBook((orderBook) => {
        const newOrderBook = { ...orderBook }
        newOrderBook[orderBookEventOrder.id] = {
          orderId: orderBookEventOrder.id,
          publicShareNullifier: orderBookEventOrder.public_share_nullifier,
          isLocal: orderBookEventOrder.local,
          clusterId: orderBookEventOrder.cluster,
          state: orderBookEventOrder.state,
          timestamp: orderBookEventOrder.timestamp,
          handshakeState: "not-matching",
        } as CounterpartyOrder
        return newOrderBook
      })
    } else {
      console.error("Unknown order book event type:", orderBookEventType)
    }
  })

  const toast = useToast()
  let lastToastTime = 0
  renegade.registerMpcCallback((message: string) => {
    console.log("[MPC]", message)
    const mpcEvent = JSON.parse(message)
    const mpcEventOrderId = mpcEvent.local_order_id
    if (Date.now() - lastToastTime < 500) {
      return
    } else {
      lastToastTime = Date.now()
    }
    const toastId =
      mpcEvent.type === "HandshakeCompleted"
        ? "handshake-completed"
        : "handshake-started"
    if (!toast.isActive(toastId)) {
      toast({
        id: toastId,
        title: `MPC ${
          mpcEvent.type === "HandshakeCompleted" ? "Finished" : "Started"
        }`,
        description: `A handshake with a counterparty has ${
          mpcEvent.type === "HandshakeCompleted" ? "completed" : "begun"
        }.`,
        status: "info",
        duration: 5000,
        isClosable: true,
      })
    }
    if (orderBook[mpcEventOrderId]) {
      const handshakeState =
        mpcEvent.type === "HandshakeCompleted" ? "completed" : "in-progress"
      setOrderBook((orderBook) => {
        const newOrderBook = { ...orderBook }
        newOrderBook[mpcEventOrderId].handshakeState = handshakeState
        return newOrderBook
      })
    }
  })

  // Define the setAccount handler. This handler unregisters the previous
  // account ID, registers the new account ID, and starts an initializeAccount
  // task.
  //
  // Once the new initializeAccount task has completed, we register a callback
  // to stream all account events.
  async function setAccount(
    oldAccountId?: AccountId,
    keychain?: Keychain
  ): Promise<void> {
    if (oldAccountId) {
      await renegade.unregisterAccount(oldAccountId)
    }
    // TODO: Tear down the previously-registered callback ID.
    if (!keychain) {
      setAccountId(undefined)
      return
    }
    // Register and initialize the new account.
    const accountId = renegade.registerAccount(keychain)
    const [taskId, taskJob] = await renegade.task.initializeAccount(accountId)
    setTask(taskId, TaskType.InitializeAccount)
    await taskJob
    setAccountId(accountId)
    // After the initialization has completed, query the current balances,
    // orders, and fees, and start streaming.
    const refreshAccount = () => {
      setBalances(renegade.getBalances(accountId))
      setOrders(renegade.getOrders(accountId))
      setFees(renegade.getFees(accountId))
    }
    refreshAccount()
    await renegade.registerAccountCallback(refreshAccount, accountId, -1)
  }

  // Define the setTask handler. Given a new task ID, this handler starts
  // streaming task updates to the task state.
  async function setTask(newTaskId: TaskId, taskType: TaskType) {
    if (newTaskId === "DONE") {
      return
    }
    setTaskId(newTaskId)
    setTaskType(taskType)
    setTaskState(TaskState.Proving)
    // toast({
    //   title: "New Task State",
    //   description: "Proving",
    //   status: "info",
    //   duration: 5000,
    //   isClosable: true,
    // });
    await renegade.registerTaskCallback((message: string) => {
      const taskUpdate = JSON.parse(message).state
      setTaskState(taskUpdate.state as TaskState)
      // toast({
      //   title: "New Task State",
      //   description: taskUpdate.state,
      //   status: "info",
      //   duration: 5000,
      //   isClosable: true,
      // });
    }, newTaskId)
  }

  const refreshAccount = (accountId: AccountId) => {
    setBalances(renegade.getBalances(accountId))
    setOrders(renegade.getOrders(accountId))
    setFees(renegade.getFees(accountId))
  }
  return (
    <RenegadeContext.Provider
      value={{
        balances,
        orders,
        fees,
        accountId,
        taskId,
        taskType,
        taskState,
        counterparties,
        orderBook,
        setAccount,
        setTask,
        refreshAccount,
      }}
    >
      {children}
    </RenegadeContext.Provider>
  )
}

function useRenegade() {
  const context = React.useContext(RenegadeContext)
  if (context === undefined) {
    throw new Error("useRenegade must be used within a RenegadeProvider")
  }
  return context
}

export { RenegadeContext, RenegadeProvider, useRenegade }
