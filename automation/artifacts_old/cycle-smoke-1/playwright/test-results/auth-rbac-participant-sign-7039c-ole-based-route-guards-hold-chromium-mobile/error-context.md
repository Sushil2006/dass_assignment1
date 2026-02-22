# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - link "DASS" [ref=e5] [cursor=pointer]:
        - /url: /
      - button "Toggle navigation" [ref=e6] [cursor=pointer]
  - generic [ref=e10]:
    - generic [ref=e11]: Create participant account
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: First Name
        - textbox "First Name" [ref=e15]:
          - /placeholder: Your first name
      - generic [ref=e16]:
        - generic [ref=e17]: Last Name
        - textbox "Last Name" [ref=e18]:
          - /placeholder: Your last name
      - generic [ref=e19]:
        - generic [ref=e20]: Email
        - textbox "Email" [ref=e21]:
          - /placeholder: you@example.com
      - generic [ref=e22]:
        - generic [ref=e23]: Password
        - textbox "Password" [ref=e24]:
          - /placeholder: At least 8 characters
      - generic [ref=e25]:
        - button "Create account" [ref=e26] [cursor=pointer]
        - link "Back to login" [ref=e27] [cursor=pointer]:
          - /url: /login
```