import argparse
import os
from datetime import date

import pandas as pd
from dateutil.relativedelta import relativedelta

parser = argparse.ArgumentParser(description="Calculate how much leave you still have")
default_onboard_date = "2018-01-08"
parser.add_argument(
    "onboard_date",
    type=lambda d: date.fromisoformat(d),
    nargs="?",
    default=default_onboard_date,
    help=f"Your on-board date in iso format (default {default_onboard_date})"
)

def calculate(onboard_date, leave_rule=[10, 10, 10, 14, 14, 15, 15, 15, 15, 15, 16, 17, 18, 19, 20, 21]):
    if not os.path.isfile("leave.csv"):
        with open("leave.csv", "w") as f:
            f.write("off_date,period")
    leave_records = pd.read_csv("leave.csv")
    leave_records["off_date"] = leave_records["off_date"].apply(lambda x: date.fromisoformat(x))
    leave_records_original_size = leave_records.shape[0]
    while True:
        mission = input(
            """
            Choose one mission:
            a) Show how many leave days you can use now
            b) Add a leave record
            c) List all leave records that have been made
            q) Quit and save changes
            """
        ).lower()
        if mission not in {"a", "b", "c", "q"}:
            print("You should pick one mission from the list")
        elif mission == "a":
            time_delta = relativedelta(date.today(), onboard_date)
            leave_left = 0
            for y in range(time_delta.years+1):
                leave_left += leave_rule[y]
                if leave_left > 20:
                    leave_left = 20
                leave_taken = leave_records.loc[
                    (leave_records["off_date"] < onboard_date + relativedelta(years=y+1)) &
                    (leave_records["off_date"] >= onboard_date + relativedelta(years=y)),
                    "period"
                ].sum()
                leave_left -= leave_taken
            print(leave_left)
        elif mission == "b":
            while True:
                off_start = input("On what date does your vacation start? (yyyy-mm-dd)\n")
                try:
                    off_start = date.fromisoformat(off_start)
                    break
                except ValueError:
                    print("Unexpected date format")
            while True:
                off_period = input("How many days are you leaving?\n")
                try:
                    off_period = float(off_period)
                except ValueError:
                    print("Unreasonable leave period")
                    continue
                if off_period % 0.5 == 0:
                    break
                else:
                    print("Unreasonable leave period")
            leave_records = leave_records.append(
                pd.DataFrame({"off_date": [off_start], "period": [off_period]}), ignore_index=True
            )
            print(leave_records)
        elif mission == "c":
            print(leave_records)
        else:
            if leave_records.shape[0] > leave_records_original_size:
                leave_records.to_csv("leave.csv", index=False)
            break

if __name__ == "__main__":
    parsed_args = parser.parse_args()
    calculate(onboard_date=parsed_args.onboard_date)
