# Welcome to RemoteQuery for Typescript

RemoteQuery is a super slim library in and of TypeScript providing simple but powerful middleware between front end (Web) and database (Postgres, Mysql etc.).
Here the list of feature and highlight:

## Define a SQL as a service

```sql
-- SERVICE_ID foobar.select

select * from foobar where name like :nameFilter

```
## Use a service

http://localhost:8080/remoteQuery/foobar.select?nameFilter=hans




## Add data access

Immediately protect the service from un-authorized access

```sql
-- SERVICE_ID foobar.select
-- ROLES=HR_ADMIN

select * from foobar where name like :nameFilter

```


git remote add origin https://github.com/OOIT-com/remotequery-ts.git
git branch -M main
git push -u origin main
