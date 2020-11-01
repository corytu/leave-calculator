# leave-calculator
Just a calculator for my annual leave

簡單的個人特休計算機，管理自己的休假記錄，並且快速地知道自己還有幾天假可以放。

先在[config.ini](config.ini)將自己的到職日（`OnboardDate`，yyyy-mm-dd）填上，再更改自己公司的特休規則（`LeaveRule`，第n個數字表示到職第n年內有幾天假可以放）。完成設定後即可執行。

```shell
pipenv install
pipenv run python calculator.py
```
