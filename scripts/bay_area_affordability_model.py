#!/usr/bin/env python3
"""Every number in articles/can-you-really-afford-the-bay-area.html, in one place.

Run it to reproduce (or to re-derive after changing an assumption) the tables in
that article:

    python scripts/bay_area_affordability_model.py

Nothing here touches the site. It only prints. If you change an assumption below
and the printed figures move, the article's tables must be edited by hand to match
-- they are static HTML on purpose.

Provenance, in the article's own vocabulary:
  FACT      published, sourced, linked in the article's Sources section
  ESTIMATE  reconstructed from adjacent published data; method stated inline
  MODEL     a choice made to keep the arithmetic consistent
"""
from __future__ import annotations

# ---------------------------------------------------------------- helpers ----
def pmt(principal: float, annual_rate_pct: float, years: int = 30) -> float:
    """Level monthly payment on a fully amortising fixed-rate loan."""
    i = annual_rate_pct / 100 / 12
    n = years * 12
    return principal * i / (1 - (1 + i) ** -n) if i else principal / n


def m(x: float) -> str:
    return f"${x:,.0f}"


# ------------------------------------------------------------ assumptions ----
DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020, 2026]

# FACT (BLS CPI-U annual averages); 2026 taken as ~333 for mid-year.
CPI = {1960: 29.6, 1970: 38.8, 1980: 82.4, 1990: 130.7,
       2000: 172.2, 2010: 218.1, 2020: 258.8, 2026: 333.0}

# MODEL: representative 4-bedroom = county median single-family sale price x ~1.10.
# 2026 anchored on the CAR county median of ~$2.1M (May 2026); 1975 San Jose median
# of $37,049 and the US/CA decennial census medians anchor the back end.
# ESTIMATE for 1960 and 1970 -- the softest rows, good to roughly +/-15%.
PRICE = {1960: 19_000, 1970: 28_000, 1980: 118_000, 1990: 285_000,
         2000: 575_000, 2010: 625_000, 2020: 1_425_000, 2026: 2_300_000}

# Santa Clara County median household income, nominal. FACT from 1990 onward
# (census / ACS); ESTIMATE before that.
INCOME = {1960: 7_400, 1970: 12_700, 1980: 24_700, 1990: 48_100,
          2000: 74_300, 2010: 89_100, 2020: 126_000, 2026: 175_000}

# FACT: Freddie Mac PMMS annual averages 1980-2020; 6.71% is the 3 Sep 2026 reading.
# ESTIMATE for 1960 and 1970 -- the survey only begins in April 1971.
RATE = {1960: 6.00, 1970: 8.50, 1980: 13.74, 1990: 10.13,
        2000: 8.05, 2010: 4.69, 2020: 3.11, 2026: 6.71}

# MODEL: pre-Proposition 13, an effective 2.5% of market value; after 1978, 1.25%
# of purchase price in year one (the 1% base rate plus ~0.25% of local bonds).
PTAX_RATE = {y: (0.025 if y < 1980 else 0.0125) for y in DECADES}

# ESTIMATE: reconstructed homeowners insurance series.
INSURANCE = {1960: 60, 1970: 110, 1980: 300, 1990: 600,
             2000: 850, 2010: 1_100, 2020: 1_500, 2026: 2_200}

# MODEL: typical size of the representative house as the stock modernised.
SQFT = {1960: 1200, 1970: 1450, 1980: 1650, 1990: 1850,
        2000: 2000, 2010: 2100, 2020: 2100, 2026: 2100}

# MODEL, and the one worth arguing about: maintenance is a PHYSICAL cost, not a
# percentage of price. Roofs do not get more expensive because land does. About
# $4.30 per square foot per year in 2026 dollars, CPI-deflated and size-scaled.
MAINT_PSF_2026 = 4.30

DOWN_PCT = 0.20     # MODEL: same deposit in every decade, so the world moves, not the financing
TERM = 30           # MODEL


def to_2026(x: float, year: int) -> float:
    return x * CPI[2026] / CPI[year]


def maintenance(year: int) -> float:
    return round(MAINT_PSF_2026 * SQFT[year] * CPI[year] / CPI[2026], -1)


# --------------------------------------------------------- part I: tables ----
def housing_table() -> dict[int, dict]:
    rows: dict[int, dict] = {}
    for y in DECADES:
        price, income = PRICE[y], INCOME[y]
        down = price * DOWN_PCT
        loan = price - down
        monthly = pmt(loan, RATE[y], TERM)
        ptax = price * PTAX_RATE[y]
        maint = maintenance(y)
        total = monthly * 12 + ptax + INSURANCE[y] + maint
        rows[y] = dict(price=price, income=income, down=down, loan=loan,
                       monthly=monthly, ptax=ptax, ins=INSURANCE[y], maint=maint,
                       total=total, pct_income=total / income * 100,
                       pi_pct=monthly * 12 / income * 100,
                       price_to_income=price / income,
                       price_2026=to_2026(price, y), income_2026=to_2026(income, y))
    return rows


def report_part1(rows):
    print("=" * 122)
    print("TABLES 1 AND 2 -- representative 4-bedroom, Santa Clara County, 20% down, 30-yr fixed")
    print("=" * 122)
    print(f"{'Yr':<6}{'Price':>11}{'Price 26$':>12}{'Income':>9}{'Inc 26$':>10}{'P/I':>6}"
          f"{'Rate':>7}{'Down':>10}{'Loan':>12}{'Mo P&I':>9}{'Tax':>9}{'Ins':>7}"
          f"{'Maint':>8}{'TOTAL':>10}{'%inc':>6}{'P&I%':>6}")
    for y in DECADES:
        d = rows[y]
        print(f"{y:<6}{m(d['price']):>11}{m(d['price_2026']):>12}{m(d['income']):>9}"
              f"{m(d['income_2026']):>10}{d['price_to_income']:>6.1f}{RATE[y]:>6.2f}%"
              f"{m(d['down']):>10}{m(d['loan']):>12}{m(d['monthly']):>9}{m(d['ptax']):>9}"
              f"{m(d['ins']):>7}{m(d['maint']):>8}{m(d['total']):>10}"
              f"{d['pct_income']:>5.0f}%{d['pi_pct']:>5.0f}%")

    print("\nDown payment measured in years of median household income:")
    for y in DECADES:
        print(f"  {y}: {m(rows[y]['down']):>10} = {rows[y]['down']/INCOME[y]:.2f} years")

    print("\nThirty-year interest, and what it is as a share of the sum borrowed:")
    for y in DECADES:
        d = rows[y]
        paid = d['monthly'] * 360
        print(f"  {y}: loan {m(d['loan']):>12}  total paid {m(paid):>12}  "
              f"interest {m(paid - d['loan']):>12}  ({(paid - d['loan'])/d['loan']*100:.0f}% of principal)")


# ------------------------------------------------- part II: proposition 13 ----
def report_prop13(bought_year=1995, bought_price=310_000, now_year=2026,
                  new_price=2_300_000, rate=0.0125):
    print("\n" + "=" * 122)
    print("PART II -- PROPOSITION 13: SAME STREET, SAME HOUSE")
    print("=" * 122)
    years = now_year - bought_year
    base = bought_price * (1.02 ** years)      # FACT: the cap is 2% a year
    old_bill, new_bill = base * rate, new_price * rate
    print(f"  Longtime owner: bought {bought_year} at {m(bought_price)}; "
          f"{years} years at the 2% cap -> assessed {m(base)}")
    print(f"     tax {m(old_bill)}/yr ({m(old_bill/12)}/mo), an effective "
          f"{old_bill/new_price*100:.2f}% of market value")
    print(f"  2026 buyer: paid {m(new_price)}, assessed at the purchase price")
    print(f"     tax {m(new_bill)}/yr ({m(new_bill/12)}/mo), an effective {rate*100:.2f}%")
    print(f"  GAP {m(new_bill - old_bill)}/yr  =  {new_bill/old_bill:.1f}x  "
          f"=  {m((new_bill - old_bill) * 10)} over a decade")


# --------------------------------------------- part III: rate vs principal ----
def report_rates(rows):
    print("\n" + "=" * 122)
    print("PART III -- WHICH MORTGAGE WOULD YOU RATHER HAVE?")
    print("=" * 122)
    for y in (1980, 2026):
        d = rows[y]
        paid = d['monthly'] * 360
        print(f"  {y}: {m(d['price'])} house, {m(d['loan'])} at {RATE[y]}% -> "
              f"{m(d['monthly'])}/mo = {d['pi_pct']:.0f}% of median income; "
              f"interest {m(paid - d['loan'])}")

    loan26, loan80 = rows[2026]['loan'], rows[1980]['loan']
    print(f"\n  Swap the rates:")
    print(f"    2026 loan at 1980's rate: {m(pmt(loan26, RATE[1980]))}/mo")
    print(f"    1980 loan at 2026's rate: {m(pmt(loan80, RATE[2026]))}/mo")
    print(f"    2026 loan if rates fell to 4%: {m(pmt(loan26, 4.0))}/mo")

    # What rate would make 2026 hurt exactly as much as 1980 did?
    target = INCOME[2026] * (rows[1980]['pi_pct'] / 100) / 12
    lo, hi = 0.01, 25.0
    for _ in range(200):
        mid = (lo + hi) / 2
        hi, lo = (mid, lo) if pmt(loan26, mid) > target else (hi, mid)
    print(f"\n  1980's payment was {rows[1980]['pi_pct']:.0f}% of median income "
          f"-> the 2026 equivalent is {m(target)}/mo")
    print(f"    On {m(loan26)} that needs a rate of {lo:.2f}%  <-- i.e. roughly the 2020 rate")

    # ...or, holding the rate, how small would the loan have to be?
    lo2, hi2 = 1.0, 5_000_000.0
    for _ in range(200):
        mid = (lo2 + hi2) / 2
        hi2, lo2 = (mid, lo2) if pmt(mid, RATE[2026]) > target else (hi2, mid)
    print(f"    At today's {RATE[2026]}%, the loan would have to shrink to {m(lo2)} "
          f"(a {m(lo2 / (1 - DOWN_PCT))} house)")


if __name__ == "__main__":
    rows = housing_table()
    report_part1(rows)
    report_prop13()
    report_rates(rows)
    print("\nSee also: scripts/bay_area_household_model.py for the 2026 tax model, the")
    print("family budget, the income scenarios, the stress test and years of financial freedom.")
