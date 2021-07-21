import pandas as pd
from database import dbsql

# get data from SQL
cols = [
    'fpl as player_id',
    'web_name',
    'season',
    'position',
    'minutes',
    'team',
    'value',
    'value_group',
    'value_category',
    'pts',
    'pts_adj',
    'xpts',
    'xpts_90',
    'color_code'
]
where = 'position <> 1 and minutes >= 900'
data = dbsql.read_from_sql('stats_player_xpts', cols=cols, where=where)

# get colour names for js classes
category_map = {
    '<5.5': 'blue',
    '5.5-7.5': 'purple',
    '7.5-10': 'red',
    '10+': 'orange'
}
data['group_color'] = data['value_category'].map(category_map)

# data types
data['player_id'] = data['player_id'].astype(int)

# print(data.head(10).to_string())
# print(data[data['web_name'] == 'De Bruyne'].to_string())
# print(data[['pts_adj', 'xpts_fbref', 'xpts_understat', 'xpts']].sum().to_string())
# print(data.head(200).to_string())

# output csv
data.to_csv('xpts.csv', index=False)

