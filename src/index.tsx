import * as React from 'react'
import {autorun, when} from 'mobx'
import {useLocalStore, useObserver} from 'mobx-react-lite'
import dot from 'dot-prop'
import isEqual from 'react-fast-compare'

export const FormContext = React.createContext<{
  Field?: React.FC<FieldProps>
  form?: FormState<any>
}>({})

export const useFormContext = () => React.useContext(FormContext)

function handleYupErrors<Values>(
  yupError: YupValidationError<Values>,
  form: FormState<Values>
) {
  if (yupError.path) {
    form.setFieldError(yupError.path, yupError.message)
  } else {
    const errors: FormErrors = {}
    for (let err of yupError.inner) {
      if (err.path) errors[err.path] = err.message
    }
    form.setErrors(errors)
  }
}

/**
 * @example
 * const {form} = useForm({
 *  initialValues: {
 *    email: ''
 *  }
 * })
 */
export function useForm<Values>(props: FormProps<Values>) {
  const {
    initialValues,
    validationSchema,
    onSubmit,
    validateOnBlur = false,
    validateOnChange = false,
    validateOnSubmit = true,
  } = props
  const form = useLocalStore<FormState<Values>>(() => ({
    isSubmitting: false,
    isValidating: false,
    isDirty: false,
    isValid: false,
    submitCount: 0,
    validateOnChange,
    validateOnBlur,
    validateOnSubmit,
    values: initialValues,
    initialValues,
    errors: {},
    touched: {},
    validate: (field?: string) => {
      if (typeof validationSchema !== 'object') return
      form.isValidating = true

      function clearErrors() {
        if (field) {
          form.setFieldError(field, undefined)
        } else {
          form.setErrors({})
        }
      }

      function handleErrors(err: any) {
        if (err.name === 'ValidationError') {
          handleYupErrors<Values>(err, form)
        } else {
          // We throw any other errors
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              'Warning: An unhandled error was caught during validation in',
              err
            )
          }
        }
      }

      function finish() {
        form.isValidating = false
      }

      if (field && validationSchema.validateAt) {
        validationSchema
          .validateAt(field, form.values)
          .then(clearErrors)
          .catch(handleErrors)
          .then(finish)
      } else {
        validationSchema
          .validate(form.values, {
            abortEarly: false,
          })
          .then(clearErrors)
          .catch(handleErrors)
          .then(finish)
      }
    },
    submit: async () => {
      if (typeof onSubmit === 'function') {
        form.isSubmitting = true
        form.validate()
        await onSubmit(form.values, form)
        form.isSubmitting = false
        form.submitCount++
      }
    },
    reset(nextState = {}) {
      form.isValidating = false
      form.setIsSubmitting(false)
      form.setValues(nextState.values || initialValues)
      form.setErrors(nextState.errors || {})
      form.setTouched(nextState.touched || {})
    },
    setIsSubmitting(value) {
      form.isSubmitting = value
    },
    setErrors(errors) {
      form.errors = errors
    },
    setFieldError(field, message) {
      if (message !== undefined) {
        dot.set(form.errors, field, message)
        return
      }

      dot.delete(form.errors, field)

      // Remove parent object if empty
      const fieldParentPath = field
        .split('.')
        .slice(0, -1)
        .join('.')
      const parent: object = dot.get(form.errors, fieldParentPath)

      if (parent && Object.keys(parent).length === 0) {
        dot.delete(form.errors, fieldParentPath)
      }
    },
    setValues(values) {
      form.values = values
      when(() => form.validateOnChange, form.validate)
    },
    setFieldValue(field, value) {
      dot.set(form.values, field, value)
      when(() => form.validateOnChange, () => form.validate(field))
    },
    setTouched(touched) {
      form.touched = touched
      when(() => form.validateOnBlur, form.validate)
    },
    setFieldTouched(field, isTouched) {
      dot.set(form.touched, field, isTouched)
      when(() => form.validateOnBlur, () => form.validate(field))
    },
  }))

  const handleChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    form.setFieldValue(field, event.target.value)
    when(() => form.validateOnChange, () => form.validate(field))
  }

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }
    form.submit()
  }

  const handleBlur = (field: string) => (
    _event: React.ChangeEvent<HTMLInputElement>
  ) => {
    form.setFieldTouched(field, true)
    when(() => form.validateOnBlur, () => form.validate(field))
  }

  const getFieldProps = (field: string) => ({
    value: dot.get(form.values, field),
    onChange: handleChange(field),
    onBlur: handleBlur(field),
  })

  const Field = (props: FieldProps) => {
    const {component: Component, ...fieldProps} = props

    return useObserver(() => (
      <Component {...fieldProps} {...getFieldProps(fieldProps.name)} />
    ))
  }

  const Form: React.FC<React.FormHTMLAttributes<{}>> = props => (
    <FormContext.Provider value={{form, Field}}>
      <form onSubmit={handleSubmit} {...props} />
    </FormContext.Provider>
  )

  const ErrorMessage: React.FC<ErrorMessageProps> = props => {
    return useObserver(() => {
      const error = dot.get<string>(form.errors, props.name)

      if (error) {
        if (typeof props.component === 'string') {
          return React.createElement(
            props.component,
            {
              className: props.className,
            },
            error
          )
        } else if (typeof props.component === 'function') {
          return (
            <props.component className={props.className}>
              {error}
            </props.component>
          )
        }
        return <div className={props.className}>{error}</div>
      }
      return null
    })
  }

  autorun(() => {
    form.isValid = form.errors && Object.keys(form.errors).length === 0
  })

  autorun(() => {
    form.isDirty = !isEqual(initialValues, form.values)
  })

  return {form, Field, Form, ErrorMessage}
}

type YupValidationError<Values> = {
  errors: string[]
  inner: YupValidationError<Values>[]
  message: string
  name: string
  path?: string
  type?: string
  value: Partial<Values>
}
export type FormProps<Values> = {
  initialValues: Values
  validationSchema?: any
  /**
   * @default false
   */
  validateOnChange?: boolean
  /**
   * @default false
   */
  validateOnBlur?: boolean
  /**
   * @default true
   */
  validateOnSubmit?: boolean
  onSubmit?: (values: Values, form: FormState<Values>) => void
}
export type FormActions<Values> = {
  reset: (nextState?: {
    values?: Values
    errors?: FormErrors
    touched?: FormTouched
  }) => void
  submit: () => void
  validate: (field?: string) => void
  setIsSubmitting: (value: boolean) => void
  setValues: (values: Values) => void
  setErrors: (errors: FormErrors) => void
  setTouched: (values: FormTouched) => void
  setFieldValue: (field: string, value: any) => void
  setFieldError: (field: string, message?: string) => void
  setFieldTouched: (field: string, isTouched: boolean) => void
}
export type FormTouched = {[field: string]: boolean}
export type FormErrors = {[field: string]: string}
export type FormState<Values> = {
  isSubmitting: boolean
  isValidating: boolean
  isDirty: boolean
  isValid: boolean
  submitCount: number
  validateOnChange: boolean
  validateOnBlur: boolean
  validateOnSubmit: boolean
  values: Values & {[field: string]: any}
  initialValues: Values
  errors: FormErrors
  touched: FormTouched
} & FormActions<Values>
type GenericFieldHTMLAttributes =
  | React.InputHTMLAttributes<HTMLInputElement>
  | React.SelectHTMLAttributes<HTMLSelectElement>
  | React.TextareaHTMLAttributes<HTMLTextAreaElement>
export type FieldProps = {
  component: React.ComponentType<any>
  name: string
} & GenericFieldHTMLAttributes
export type ErrorMessageProps = {
  className?: string
  component?: string | React.ComponentType<any>
  name: string
}
