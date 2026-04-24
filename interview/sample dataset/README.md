# 📊 Data Engineer Interview Prep — Practice Datasets

## What's Included

| CSV File | Rows | For SQL Example(s) |
|----------|------|-------------------|
| users.csv | 200 | #1 Anti-Join, #11 Self-Join, Cohort Retention |
| purchases.csv | 300 | #1 Anti-Join |
| user_profiles.csv | 334 | #2 ROW_NUMBER Deduplication |
| weekly_metrics.csv | 52 | #3 WoW Growth (LAG) |
| sessions.csv | 800 | #4 CASE Pivot |
| products.csv | 50 | #5 Top-N Per Group |
| clickstream.csv | 1,971 | #6 Sessionization |
| events.csv | 1,014 | #7 Funnel Analysis |
| logins.csv | 1,925 | #8 Consecutive Login Streaks |
| daily_metrics.csv | 120 | #9 Running Total, #14 Moving Average |
| daily_metrics_gapped.csv | 105 | #13 Date Spine (Fill Missing Dates) |
| employees.csv | 28 | #11 Self-Join, #15 Recursive CTE |
| orders.csv | 500 | #12 Cumulative Distribution, #17 Correlated Subquery |
| product_dim.csv | 68 | #19 SCD Type 2 |
| skewed_table.csv | 1,000 | #18 Data Skew Detection |

## Quick Start

### PostgreSQL
```bash
psql -d your_db -f setup_postgres.sql
# Then load each CSV:
psql -d your_db -c "\copy users FROM 'users.csv' WITH CSV HEADER"
psql -d your_db -c "\copy purchases FROM 'purchases.csv' WITH CSV HEADER"
# ... repeat for each table
```

### MySQL
```bash
mysql -u root -p < setup_mysql.sql
# Then load each CSV:
mysql -u root -p interview_prep -e "LOAD DATA LOCAL INFILE 'users.csv' INTO TABLE users FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n' IGNORE 1 ROWS;"
# ... repeat for each table
```

### Python (pandas)
```python
import pandas as pd
users = pd.read_csv('users.csv', parse_dates=['signup_date'])
purchases = pd.read_csv('purchases.csv', parse_dates=['purchase_date'])
# Ready to practice!
```

## Data Characteristics
- **Realistic distributions**: Revenue uses log-normal, user counts use normal
- **Intentional duplicates**: user_profiles has 334 rows for 200 users (for dedup exercise)
- **Missing data**: daily_metrics_gapped has 15 dates removed (for date spine exercise)
- **Data skew**: skewed_table has 70% of rows with join_key='hot_key' (for skew exercise)
- **Funnel drop-off**: events has 100% signup → 72% activation → 31% purchase
- **SCD Type 2**: product_dim tracks historical price changes with effective/expiry dates

Good luck with your interview prep! 🚀
