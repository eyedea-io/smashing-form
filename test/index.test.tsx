import * as React from 'react'
import {useForm} from '../src'
import {render, fireEvent, wait, waitForElement} from '@testing-library/react'
import * as yup from 'yup'
import {useObserver} from 'mobx-react-lite'
const TextInput = (props: any) => <input {...props} />

const initialValues = {
  email: '',
  username: 'john.doe',
}
const TEST_ON_SUBMIT = 'test-on-submit'
const EMAIL_IS_REQUIRED = 'Email is required'
const EMAIL_INVALID = 'Email is invalid'
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .email(EMAIL_INVALID)
    .required(EMAIL_IS_REQUIRED),
  username: yup.string().min(32),
})
const App = () => {
  const {Form, Field, form} = useForm({
    initialValues,
    validateOnBlur: true,
    validateOnChange: true,
    validateOnSubmit: true,
    validationSchema,
    onSubmit: () => document.body.classList.add(TEST_ON_SUBMIT),
  })

  return useObserver(() => (
    <Form>
      <Field component={TextInput} name="email" data-testid="email" />
      {form.errors.email && (
        <div data-testid="email_error">{form.errors.email}</div>
      )}
      <Field component={TextInput} name="username" />
      <button type="submit">submit</button>
      <button type="button" onClick={() => form.reset()}>
        reset
      </button>
    </Form>
  ))
}

describe('useForm', () => {
  it('contains Form and Field components', () => {
    render(<App />)
  })
  it('renders input with initial value', () => {
    const {getByDisplayValue} = render(<App />)
    const input = getByDisplayValue(initialValues.username)
    expect(input.getAttribute('value')).toEqual(initialValues.username)
  })
  it('updates input value', () => {
    const {getByTestId} = render(<App />)
    const value = 'jane.doe'
    const input = getByTestId('email')
    fireEvent.change(input, {target: {value}})
    expect(input.getAttribute('value')).toEqual(value)
  })
  it('can handle onSubmit', () => {
    const {getByText, getByTestId} = render(<App />)
    const submitButton = getByText('submit')
    const value = 'invalid.email'
    const input = getByTestId('email')
    fireEvent.click(submitButton)
    fireEvent.change(input, {target: {value}})
    expect(document.body.classList.contains(TEST_ON_SUBMIT))
  })
  it('validates input on submit', async () => {
    const {getByText, getByTestId} = render(<App />)
    const submitButton = getByText('submit')
    fireEvent.click(submitButton)
    await wait(() => getByTestId('email_error'))
    expect(getByTestId('email_error').innerHTML).toEqual(EMAIL_IS_REQUIRED)
  })
  it('validates input on blur', async () => {
    const {getByTestId} = render(<App />)
    const input = getByTestId('email')
    fireEvent.focus(input)
    fireEvent.blur(input)
    await wait(() => getByTestId('email_error'))
    expect(getByTestId('email_error').innerHTML).toEqual(EMAIL_IS_REQUIRED)
  })
  it('validates input on change', async () => {
    const {getByTestId} = render(<App />)
    const input = getByTestId('email')
    fireEvent.change(input, {target: {value: 'changed'}})
    await wait(() => getByTestId('email_error'))
    expect(getByTestId('email_error').innerHTML).toEqual(EMAIL_INVALID)
  })
  it('clears data on reset', async () => {
    const {getByTestId, getByText} = render(<App />)
    const input = getByTestId('email')
    const value = 'changed'
    fireEvent.change(input, {target: {value}})
    await waitForElement(() => getByTestId('email_error'))
    expect(getByTestId('email_error').innerHTML).toEqual(EMAIL_INVALID)
    const resetButton = getByText('reset')
    fireEvent.click(resetButton)
  })
})
