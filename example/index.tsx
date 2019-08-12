import 'react-app-polyfill/ie11'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {useForm, useFormContext} from '../.'
import {useObserver, Observer, observer} from 'mobx-react-lite'
import * as yup from 'yup'
import './styles.css'

const Input = {
  Text: props => <input {...props} />,
}

const Message = props => <div style={{fontSize: 12, color: 'red'}} {...props} />

const CustomErrorMessage = observer(({name}: {name: string}) => {
  const {form} = useFormContext()

  if (form && form.errors[name]) {
    return <Message>{form.errors[name]}</Message>
  }

  return null
})

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
  social: yup.object().shape({
    facebook: yup
      .string()
      .url()
      .required(),
    twitter: yup.string(),
  }),
  friends: yup.array(
    yup
      .string()
      .email()
      .required()
  ),
})

const FriendItem: React.FC<{index: number}> = ({index}) => {
  const {Field, ErrorMessage, form} = useFormContext()

  if (!Field || !form || !ErrorMessage) return null

  return useObserver(() => (
    <div>
      <Field
        component={Input.Text}
        name={`friends.${index}`}
        placeholder={`Friend ${index}`}
      />
      <ErrorMessage name={`friends.${index}`} />
      <button
        type="button"
        onClick={() => {
          form.values.friends.splice(index, 1)
        }}
      >
        X
      </button>
    </div>
  ))
}

const FriendList: React.FC<{items: any[]}> = observer(({items}) => (
  <div>
    {items.map((_item, index) => (
      <FriendItem key={index} index={index} />
    ))}
  </div>
))

function App() {
  const {Form, Field, ErrorMessage, form} = useForm({
    validateOnChange: true,
    initialValues: {
      email: '',
      password: '',
      social: {
        facebook: '',
        twitter: '',
      },
      friends: ['John', ''],
    },
    validationSchema,
    onSubmit: async () => new Promise(resolve => setTimeout(resolve, 1000)),
  })

  return useObserver(() => (
    <div className="App">
      <Observer>{() => <pre>{JSON.stringify(form, null, 2)}</pre>}</Observer>

      <Form>
        <div>
          <Field component={Input.Text} name="email" placeholder="email" />
          <ErrorMessage name="email" />
        </div>
        <div>
          <Field
            component={Input.Text}
            name="password"
            type="password"
            placeholder="password"
          />
          <CustomErrorMessage name="password" />
        </div>
        <div>
          <Field
            component={Input.Text}
            name="social.twitter"
            placeholder="twitter"
          />
          <ErrorMessage name="social.twitter" />
        </div>
        <div>
          <Field
            component={Input.Text}
            name="social.facebook"
            placeholder="facebook"
          />
          <ErrorMessage name="social.facebook" />
        </div>
        <FriendList items={form.values.friends} />
        <button
          type="button"
          onClick={() => {
            form.values.friends.push('')
          }}
        >
          Add Friend
        </button>

        <div className="actions">
          <Observer>
            {() => (
              <button type="submit" disabled={form.isSubmitting}>
                submit
              </button>
            )}
          </Observer>
          <button type="button" onClick={() => form.reset()}>
            reset
          </button>
          <button
            type="button"
            onClick={() => form.setIsSubmitting(!form.isSubmitting)}
          >
            toggleIsSubmitting
          </button>
        </div>
      </Form>
    </div>
  ))
}

const rootElement = document.getElementById('root')
ReactDOM.render(<App />, rootElement)
