# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - link "DASS" [ref=e5] [cursor=pointer]:
        - /url: /
      - generic [ref=e7]:
        - link "Login" [ref=e8] [cursor=pointer]:
          - /url: /login
        - link "Participant Signup" [ref=e9] [cursor=pointer]:
          - /url: /signup
  - generic [ref=e12]:
    - generic [ref=e13]: Create participant account
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: First Name
        - textbox "First Name" [ref=e17]:
          - /placeholder: Your first name
      - generic [ref=e18]:
        - generic [ref=e19]: Last Name
        - textbox "Last Name" [ref=e20]:
          - /placeholder: Your last name
      - generic [ref=e21]:
        - generic [ref=e22]: Email
        - textbox "Email" [ref=e23]:
          - /placeholder: you@example.com
      - generic [ref=e24]:
        - generic [ref=e25]: Password
        - textbox "Password" [ref=e26]:
          - /placeholder: At least 8 characters
      - generic [ref=e27]:
        - button "Create account" [ref=e28] [cursor=pointer]
        - link "Back to login" [ref=e29] [cursor=pointer]:
          - /url: /login
```