import {
  type Accessor,
  createContext,
  createSignal,
  type ParentComponent,
  useContext,
} from 'solid-js'
import {
  runAllTests,
  type TestResults,
  type TestStatus,
} from '../utils/test-runner.ts'

interface TestContextValue {
  testResults: Accessor<TestResults>
  isRunning: Accessor<boolean>
  runTests: (
    code: string,
    inputs: Array<{ name: string; input: string }>,
    expectedOutputs: Map<string, string>,
  ) => Promise<void>
  getStatusForInput: (inputName: string) => TestStatus | undefined
}

const TestContext = createContext<TestContextValue>()

export const TestProvider: ParentComponent = (props) => {
  const [testResults, setTestResults] = createSignal<TestResults>(new Map())
  const [isRunning, setIsRunning] = createSignal(false)

  const runTests = async (
    code: string,
    inputs: Array<{ name: string; input: string }>,
    expectedOutputs: Map<string, string>,
  ) => {
    if (!code.trim() || inputs.length === 0) {
      setTestResults(new Map())
      return
    }

    setIsRunning(true)
    try {
      await runAllTests(code, inputs, expectedOutputs, (results) => {
        setTestResults(results)
      })
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusForInput = (inputName: string): TestStatus | undefined => {
    return testResults().get(inputName)?.status
  }

  return (
    <TestContext.Provider
      value={{
        testResults,
        isRunning,
        runTests,
        getStatusForInput,
      }}
    >
      {props.children}
    </TestContext.Provider>
  )
}

export const useTestContext = () => {
  const context = useContext(TestContext)
  if (!context) {
    throw new Error('useTestContext must be used within a TestProvider')
  }
  return context
}
