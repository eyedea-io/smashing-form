import * as React from 'react'
import {autorun, when} from 'mobx'
import {useLocalStore, useObserver} from 'mobx-react-lite'
import dot from 'dot-prop'
import isEqual from 'react-fast-compare'

export const FormContext = React.createContext<{
  Field?: React.FC<FieldProps>
  ErrorMessage?: React.FC<ErrorMessageProps>
  form?: FormState<any>
}>({})

export const useFormContext = () => React.useContext(FormContext)

function handleYupErrors<Values>(
  yupError: YupValidationError<Values>,
  form: FormState<Values>
) {
  if (yupError.path) {
    form.setFieldError(
      yupError.path.replace(/\[(\d+)\]/g, '.$1'),
      yupError.message
    )
  } else {
    const errors: FormErrors = {}
    for (let err of yupError.inner) {
      if (err.path) errors[err.path.replace(/\[(\d+)\]/g, '.$1')] = err.message
    }
    form.setErrors(errors)
  }
}

function getValueForCheckbox(
  currentValue: string | any[],
  checked: boolean,
  value: any
) {
  if (value == 'true' || value == 'false') {
    return !!checked
  }

  if (checked) {
    return Array.isArray(currentValue) ? currentValue.concat(value) : [value]
  }

  if (!Array.isArray(currentValue)) {
    return !!currentValue
  }

  const index = currentValue.indexOf(value)

  if (index < 0) {
    return currentValue
  }

  return currentValue.slice(0, index).concat(currentValue.slice(index + 1))
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
    validate: async (field?: string) => {
      if (typeof validationSchema !== 'object') return
      form.isValidating = true

      try {
        if (field && validationSchema.validateAt) {
          await validationSchema.validateAt(field, form.values)
        } else {
          await validationSchema.validate(form.values, {
            abortEarly: false,
          })
        }

        if (field) {
          form.setFieldError(field, undefined)
        } else {
          form.setErrors({})
        }
      } catch (err) {
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
      } finally {
        form.isValidating = false
      }
    },
    submit: async () => {
      if (typeof onSubmit === 'function') {
        form.isSubmitting = true
        if (form.validateOnSubmit) {
          await form.validate()

          if (form.isValid) {
            await onSubmit(form.values, form)
          }
        } else {
          await onSubmit(form.values, form)
        }
        form.isSubmitting = false
        form.submitCount++
      }
    },
    reset(nextState = {}) {
      form.isValidating = false
      form.setIsSubmitting(false)
      form.values = nextState.values || initialValues
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

  const handleChange = React.useCallback(
    (field: string, onChange: GenericFieldHTMLAttributes['onChange']) => (
      event:
        | React.ChangeEvent<HTMLInputElement> &
            React.ChangeEvent<HTMLSelectElement> &
            React.ChangeEvent<HTMLTextAreaElement>
        | string
    ) => {
      if (typeof event !== 'string') {
        const {type, checked, value} = event.target
        const val = /checkbox/.test(type)
          ? getValueForCheckbox(dot.get(form.values, field), checked, value)
          : value

        form.setFieldValue(field, val)
      } else {
        form.setFieldValue(field, event)
      }

      if (typeof onChange === 'function' && typeof event !== 'string') {
        onChange(event)
      }

      when(() => form.validateOnChange, () => form.validate(field))
    },
    [form]
  )

  const handleSubmit = React.useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      if (event) {
        event.preventDefault()
      }
      form.submit()
    },
    [form]
  )

  const handleBlur = React.useCallback(
    (field: string, onBlur?: GenericFieldHTMLAttributes['onBlur']) => (
      event: React.FocusEvent<HTMLInputElement> &
        React.FocusEvent<HTMLSelectElement> &
        React.FocusEvent<HTMLTextAreaElement>
    ) => {
      form.setFieldTouched(field, true)
      if (typeof onBlur === 'function') {
        onBlur(event)
      }
      when(() => form.validateOnBlur, () => form.validate(field))
    },
    [form]
  )

  const getFieldProps = (props: FieldProps) => {
    const field: any = {
      onChange: handleChange(props.name, props.onChange),
      onBlur: handleBlur(props.name, props.onBlur),
      value: dot.get(form.values, props.name),
    }

    if (props.type === 'checkbox') {
      if (props.value === undefined) {
        field.checked = !!field.value
      } else {
        field.checked = !!(
          Array.isArray(field.value) && ~field.value.indexOf(props.value)
        )
        field.value = props.value
      }
    } else if (props.type === 'radio') {
      field.checked = field.value === props.value
      field.value = props.value
    } else if (props.multiple) {
      field.value = field.value || []
      field.multiple = true
    }

    return field
  }

  const ErrorMessage: React.FC<ErrorMessageProps> = React.useCallback(
    props => {
      return useObserver(() => {
        const error = form.errors[props.name]

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
    },
    [form]
  )

  const Field: React.FC<
    FieldProps & React.RefAttributes<any>
  > = React.useCallback(
    React.forwardRef<any, FieldProps>((props, ref) => {
      const {component: Component = 'input', ...fieldProps} = props

      return useObserver(() => {
        if (typeof props.component === 'string') {
          return React.createElement<FieldProps>(props.component, {
            ...fieldProps,
            ...getFieldProps(fieldProps),
            ref,
          })
        } else if (typeof props.component) {
          return (
            <Component
              {...fieldProps}
              {...getFieldProps(fieldProps)}
              ref={ref}
            />
          )
        }

        return null
      })
    }),
    []
  )

  const Form: React.FC<React.FormHTMLAttributes<{}>> = React.useCallback(
    props => (
      <FormContext.Provider value={{form, Field, ErrorMessage}}>
        <form onSubmit={handleSubmit} {...props} />
      </FormContext.Provider>
    ),
    [handleSubmit, handleBlur, handleChange, form]
  )

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
  component?: React.ComponentType<any> | string
  name: string
  [key: string]: any
} & GenericFieldHTMLAttributes
export type ErrorMessageProps = {
  className?: string
  component?: string | React.ComponentType<any>
  name: string
}
