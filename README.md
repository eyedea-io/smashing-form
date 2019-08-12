# Smashing Form

> MobX powered forms in React

[![NPM](https://img.shields.io/npm/v/smashing/form.svg)](https://www.npmjs.com/package/@smashing/form)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/smashing/form)

- ⚡ Fast input rerenders - doesn't rerender whole form
- 🥓 Well cooked api
- 👌 Form validation based on [yup](https://github.com/jquense/yup)
- ⚖ [It's lightweight](https://bundlephobia.com/result?p=@smashing/form)

## Examples

- [Basic form with validation](https://codesandbox.io/s/smashing-form-clrsj)
- [Array of fields](https://codesandbox.io/s/smashing-form-arrays-7jx0n)

## Install

```bash
npm install --save @smashing/form
```

## Usage

```tsx
import * as React from 'react'
import {useForm} from '@smashing/form'

const TextInput = props => <input type="text" {...props} />

export const MyForm = () => {
  // Use `useForm` hook. `initialValues` is the only required value.
  const {Form, Field, form} = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    onSubmit: values => console.log(values),
  })

  // Wrap your inputs with `Form` returned by `useForm`
  return (
    <Form>
      {/* Each input should be wrapped in `Field` returned by `useForm` */}
      <Field component={TextInput} name="email" />
      <Field component={TextInput} name="password" />
      <button type="submit">Submit</button>
    </Form>
  )
}
```

### Options

```tsx
const {} = useForm({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnBlur,
  validateOnChange,
  validateOnSubmit,
})
```

#### `initialValues` - required

Object containing initial values of form. Can contain nested state.

#### `validationSchema` - default: undefined

Read [yup docs](https://github.com/jquense/yup) to learn more.

#### `onSubmit` - default: undefined

Form submit handler

#### `validateOnBlur` - default: false

Control if data should be validated on input blur

#### `validateOnChange` - default: false

Control if data should be validated on input change

#### `validateOnSubmit` - default: true

Control if data should be validated on form submit

### Validation

You can use [yup](https://github.com/jquense/yup) to validate form data.

```tsx
import * as React from 'react'
import * as yup from 'yup'
import {useForm} from '@smashing/form'

const TextInput = props => <input type="text" {...props} />

const validationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Email is not valid.')
    .max(64, 'Email is too long.')
    .required('This field is required.'),
  password: yup
    .string()
    .min(6, 'Password is too short.')
    .max(64, 'Password is too long.')
    .required('This field is required.'),
})

export const MyForm = () => {
  const {Form, Field, form} = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema,
    onSubmit: values => console.log(values),
  })

  return (
    <Form>
      <Field component={TextInput} name="email" />
      <Field component={TextInput} name="password" />
      <button type="submit">Submit</button>
    </Form>
  )
}
```

### Accessing form state

You can access whole state and form actions using `form` property returned from `useForm`.

```tsx
const {form} = useForm({})
```

It contains the following state:

```json
{
  "isSubmitting": false,
  "isValidating": false,
  "isDirty": false,
  "isValid": true,
  "submitCount": 0,
  "validateOnChange": false,
  "validateOnBlur": false,
  "validateOnSubmit": true,
  "values": {},
  "initialValues": {},
  "errors": {},
  "touched": {}
}
```

### Accessing form state in nested components

You can access form state using context. `FormContext` and `useFormContext` are exported from package.

```tsx
import {useFormContext, FormContext} from '@smashing/form'

const NestedComponent = () => {
  const {form} = useFormContext()
  // OR const {form} = React.useContext(FormContext)
}
```

> `FormContext`/`useFormContext` can be used only inside `Form` component returned from `useForm`.

### Handling nested data and arrays

```tsx
const MyForm = () => {
  const {Form, Field} = useForm({
    initialValues: {
      email: '',
      social: {
        twitter: '',
        facebook: '',
      },
      friends: [{name: 'John'}, {name: 'Jane'}],
    },
  })

  return (
    <Form>
      <Field component={TextInput} name="email" />
      <Field component={TextInput} name="social.twitter" />
      <Field component={TextInput} name="social.facebook" />
      <Field component={TextInput} name="friends.0.name" />
      <Field component={TextInput} name="friends.1.name" />
    </Form>
  )
}
```

Manipulating array items:

```tsx
const {form} = useForm({
  initialValues: {
    friends: ['John', 'Jane'],
  },
})

// Add new item
form.values.friends.push('')
// Remove first item
form.values.friends.splice(0, 1)
```

### Form actions

You can operate on form state using `form` object returned by `useForm`:

```tsx
const {form} = useForm({
  initialValue: {
    email: '',
    password: '',
  },
})

form.setFieldValue('email', 'john.doe@example.com')
```

#### `reset: (nextState?: {values: {}, errors: {}, touched: {}}): void`

Rest form values, errors and touch states to initial state:

```tsx
form.reset()
```

Optionally `nextState` object can be passed:

```tsx
form.reset({
  values: {email: 'john.doe@example.com'},
  errors: {password: 'Password is required'},
  touched: {
    email: true,
    password: true,
  },
})
```

#### `submit: (): void`

Trigger `onSubmit` handler.

#### `validate: (field?: string): void`

Validate all inputs:

```tsx
form.validate()
```

Validate single input:

```tsx
form.validate('email')
```

#### `setIsSubmitting: (value: boolean): void`

Start or finish submission process:

```tsx
form.setIsSubmitting(true)
```

#### `setValues: (values: Values): void`

Set all input values:

```tsx
form.setValues({
  email: '',
  password: '',
})
```

#### `setErrors: (errors: FormErrors): void`

Set all validation errors:

```tsx
form.setErrors({
  email: 'Email is invalid',
  password: 'Password is to short',
})
```

#### `setTouched: (values: FormTouched): void`

Set all inputs touch state:

```tsx
form.setTouched({
  email: true,
  password: false,
})
```

#### `setFieldValue: (field: string, value: any): void`

Set single field value:

```tsx
form.setFieldValue('email', 'john.doe@example.com')
```

#### `setFieldError: (field: string, message?: string): void`

Set single field error message:

```tsx
form.setFieldError('email', 'Email is invalid')
```

#### `setFieldTouched: (field: string, isTouched: boolean): void`

Set single field touch state:

```tsx
form.setFieldTouched('email', true)
```

## License

MIT &copy; [EYEDEA AS](https://github.com/eyedea-io)
