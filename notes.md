participant:
* parti_first_name
* parti_last_name
* parti_email (unique)
* parti_password (hashed)
* parti_type
* parti_organization_name
* parti_contact_number

organizer:
* org_name
* org_email
* org_description
* org_category

event:
* event_name
* event_description
* event_type (normal/merch)
* event_eligibility (???)
* event_reg_deadline
* event_reg_limit
* event_reg_fee
* event_start_date
* event_end_date
* event_org_id
* event_tags


for normal events --> custom reg form (dynamic form builder)

merch event:
* merch_details (size/color/variants)
* merch_quantity
* merch_purchase_limit


RBAC:
* participant --> IIIT/Non-IIIT
* organizer --> clubs/fest teams
* admin

jwt --> expires in 5 mins
cookie --> expires in 1 month (but what to do when cookie expires?)
