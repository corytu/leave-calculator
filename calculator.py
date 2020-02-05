from datetime import date, datetime

import pandas as pd
from dateutil.relativedelta import relativedelta

def calculate(onboard_date=date(2018, 1, 8)):
    while True:
        leave_records = pd.read_csv("leave.csv")
        mission = input(
            """
            Choose one mission:
            a) Show how many leave days you can use now
            b) Add a leave record
            c) List all leave records that have been made
            q) Exit
            """
        ).lower()
        if mission not in {"a", "b", "c", "q"}:
            raise ValueError("You should pick one mission from the list")
        elif mission == "a":
            # Assuming under no circumstance would the unused leave days exceed 20 days
            time_delta = relativedelta(date.today(), onboard_date)
            max_leave = (time_delta.years + 1) * 10
            leave_taken = leave_records["period"].sum()
            leave_left = max_leave - leave_taken
            if (leave_left + 10 > 20) and (time_delta.months >= 9):
                print("You are about to exceed the maximum unused leave days next year. Take a break!")
            print(leave_left)
        elif mission == "b":
            while True:
                off_start = input("On what date does your vacation start? (yyyy-mm-dd)\n")
                try:
                    # Making sure the date format is correct
                    off_start = datetime.strptime(off_start, "%Y-%m-%d").strftime("%Y-%m-%d")
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
            leave_records.to_csv("leave.csv", index=False)
            print(leave_records)
        elif mission == "c":
            print(leave_records)
        else:
            break

if __name__ == "__main__":
    calculate()
