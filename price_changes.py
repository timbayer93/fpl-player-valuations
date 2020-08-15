import numpy as np
import pandas as pd
from database import dbsql


def fpl_data():
    # params
    season = 20
    metric_cols = ['total_points', 'minutes']

    # get player meta data and their team based on current season
    cols = ['team_name', 'team_name_short', 'fpl_team_code']
    team_now = dbsql.read_from_sql(f'src_fpl_teams_{season}', is_class=False, cols=cols)

    cols = ['fpl_player_code', 'first_name', 'web_name', 'element_type', 'fpl_team_code']
    player_info1 = dbsql.read_from_sql(f'src_fpl_players_{season}', is_class=False, cols=cols)
    player_info2 = dbsql.read_from_sql(f'src_fpl_players_{season - 1}', is_class=False, cols=cols)

    # get players that have left Premier League / are part of relegated clubs
    excl_players = player_info1['fpl_player_code'].unique().tolist()
    player_info2 = player_info2[~player_info2['fpl_player_code'].isin(excl_players)]
    player_info2['fpl_team_code'] = np.nan  # remove the team from players that left

    player_info = pd.concat([player_info1, player_info2])
    player_info = player_info.merge(team_now, how='left', on='fpl_team_code')
    player_info.rename(columns={'element_type': 'position'}, inplace=True)

    # get current season stats
    cols = ['fpl_player_code', 'now_cost'] + metric_cols
    player_now = dbsql.read_from_sql(f'src_fpl_players_{season}', is_class=False, cols=cols)
    player_now['avg_price'] = player_now['now_cost'] / 10
    player_now.drop(['now_cost'], axis=1, inplace=True)
    player_now['season'] = f'20{season}/{season + 1}'

    # get historic data  TODO: make dynamic for future seasons
    cols = ['fpl_player_code', 'season', 'start_cost', 'end_cost'] + metric_cols

    player_history1 = dbsql.read_from_sql(f'src_fpl_player_history_{season}', is_class=False, cols=cols)
    player_history1['avg_price'] = round((player_history1['end_cost'] + player_history1['start_cost']) / 2, 0) / 10

    player_history2 = dbsql.read_from_sql(f'src_fpl_player_history_{season - 1}', is_class=False, cols=cols)
    player_history2['avg_price'] = round((player_history2['end_cost'] + player_history2['start_cost']) / 2, 0) / 10

    player_history = pd.concat([player_history1, player_history2])
    player_history.drop(['start_cost', 'end_cost'], axis=1, inplace=True)
    player_history.drop_duplicates(inplace=True)

    # combine historic and current data
    df = pd.concat([player_now, player_history])

    # create numeric season field
    df['season_str'] = df['season']
    df['season'] = df['season'].str[:4].astype(int)

    # add meta data
    df = df.merge(player_info, how='left', on='fpl_player_code')
    df.rename(columns={
        'team_name': 'team_now',
        'team_name_short': 'team_short_now',
        'total_points': 'pts'
    }, inplace=True)
    df.sort_values(['fpl_player_code', 'season'], inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def understat_data():
    seasons = list(range(14, 20))  # TODO: make upper limit dynamic
    where = 'competition = "Premier League" or player_id = 65'

    teams, players = [], []
    for season in seasons:
        cols = ['team_id', 'team', 'match_date', 'home', 'goals_conceded', 'xGA', 'npxGA']
        teams.append(dbsql.read_from_sql(f'src_understat_teams_{season}', is_class=False, cols=cols))

        cols = ['player_id', 'team', 'match_date', 'season', 'minutes_played', 'xG', 'npxG', 'xA']
        players.append(dbsql.read_from_sql(f'src_understat_players_{season}', where=where, is_class=False, cols=cols))

    # append all team dfs
    teams = pd.concat(teams)
    teams['match_date'] = teams['match_date'].dt.date

    # append all player dfs
    player_df = pd.concat(players)
    player_df['match_date'] = player_df['match_date'].dt.date

    # join data
    df = player_df.merge(teams, on=['team', 'match_date'], how='left')

    # xCleanSheets  - 60+ minutes only
    df['xCS'] = np.where((df['xGA'] < .75) & (df['minutes_played'] > 59), 1, 0)
    df['npxCS'] = np.where((df['npxGA'] < .75) & (df['minutes_played'] > 59), 1, 0)

    # xGoals conceded - calculate % of match played
    # we don't know if a defender was on the pitch the whole time
    df['xGA_per'] = df['xGA'] * df['minutes_played'] / 90
    df['xDef'] = df['xGA_per'] / 1.65
    df['xDef'] = np.floor(df['xDef'])
    df['xDef'] = df['xDef'] * -1

    df['npxGA_per'] = df['npxGA'] * df['minutes_played'] / 90
    df['npxDef'] = df['npxGA_per'] / 1.65
    df['npxDef'] = np.floor(df['npxDef'])
    df['npxDef'] = df['npxDef'] * -1

    # summarise by season -- taken 'team' out from group due to Jan transfers
    metric_cols = ['minutes_played', 'xG', 'npxG', 'xA', 'xCS', 'npxCS', 'xDef', 'npxDef', 'xGA', 'npxGA']
    df = df.groupby(['player_id', 'season'])[metric_cols].sum().reset_index()

    # clean up columns
    df.rename(columns={'minutes_played': 'minutesU'}, inplace=True)
    return df


def get_xPTS_data():
    fpl = fpl_data()
    understat = understat_data()

    # add player ids
    player_lookup = dbsql.read_from_sql('ref_player_ids', is_class=False, cols=['understat', 'fpl'])

    # INNER JOIN! -- missing IDs dropped
    understat = understat.merge(player_lookup, left_on='player_id', right_on='understat', how='inner')
    understat.rename(columns={'fpl': 'fpl_player_code'}, inplace=True)

    # pre-season add in new season (append a copy of last)
    understat_previous = understat[understat['season'] == 2019].copy()  # TODO: dynamic
    understat_previous['season'] = 2019 + 1
    understat = pd.concat([understat, understat_previous])

    # join understat and fpl via player lookup - check player mapping above
    df = fpl.merge(understat, how='inner', on=['fpl_player_code', 'season'])

    # Optional: amend historic positions
    df['position'] = np.where((df['fpl_player_code'] == 54694) & (df['season'] < 2020), 4, df['position'])  # Auba
    df['position'] = np.where((df['fpl_player_code'] == 176297) & (df['season'] < 2020), 4, df['position'])  # Rashford
    df['position'] = np.where((df['fpl_player_code'] == 148225) & (df['season'] < 2020), 3, df['position'])  # Martial
    df['position'] = np.where((df['fpl_player_code'] == 212319) & (df['season'] < 2020), 4, df['position'])  # Rich
    df['position'] = np.where((df['fpl_player_code'] == 194634) & (df['season'] < 2020), 4, df['position'])  # Jota
    df['position'] = np.where((df['fpl_player_code'] == 220688) & (df['season'] < 2020), 3, df['position'])  # Greenw
    df['position'] = np.where((df['fpl_player_code'] == 444145) & (df['season'] < 2020), 4,
                              df['position'])  # Martinelli
    df['position'] = np.where((df['fpl_player_code'] == 232826) & (df['season'] < 2020), 4, df['position'])  # Gordon
    df['position'] = np.where((df['fpl_player_code'] == 223349) & (df['season'] < 2020), 3, df['position'])  # Vass
    df['position'] = np.where((df['fpl_player_code'] == 171975) & (df['season'] < 2020), 3, df['position'])  # Robinson
    df['position'] = np.where((df['fpl_player_code'] == 57531) & (df['season'] < 2020), 3, df['position'])  # Antonio
    df['position'] = np.where((df['fpl_player_code'] == 153723) & (df['season'] < 2020), 2, df['position'])  # Lunny

    # xPTS
    df['xPTS'] = np.where(df['position'] == 4, df['xG'] * 4 + df['xA'] * 3, 0)
    df['xPTS'] = np.where(df['position'] == 3, df['xG'] * 5 + df['xA'] * 3 + df['xCS'], df['xPTS'])
    df['xPTS'] = np.where(df['position'] == 2, df['xG'] * 6 + df['xA'] * 3 + df['xCS'] * 4 + df['xDef'], df['xPTS'])
    df['xPTS'] = np.where(df['position'] == 1, df['xG'] * 6 + df['xA'] * 3 + df['xCS'] * 4 + df['xDef'], df['xPTS'])

    # npxPTS -- including penalties for defence though!
    df['npxPTS'] = np.where(df['position'] == 4, df['npxG'] * 4 + df['xA'] * 3, 0)
    df['npxPTS'] = np.where(df['position'] == 3, df['npxG'] * 5 + df['xA'] * 3 + df['xCS'], df['npxPTS'])
    df['npxPTS'] = np.where(df['position'] == 2, df['npxG'] * 6 + df['xA'] * 3 + df['xCS'] * 4 + df['xDef'],
                            df['npxPTS'])
    df['npxPTS'] = np.where(df['position'] == 1, df['npxG'] * 6 + df['xA'] * 3 + df['xCS'] * 4 + df['xDef'],
                            df['npxPTS'])

    # per 90 metrics -- minutes from understat
    df['xPTS_90'] = df['xPTS'] / df['minutesU'] * 90
    df['npxPTS_90'] = df['npxPTS'] / df['minutesU'] * 90

    # price groups
    price_bins = [0, 5.4, 7.4, 9.9, 100]
    price_names = ['<5.5', '5.5-7.5', '7.5-10', '10+']

    price_bins1 = [0, 3.9, 4.9, 5.9, 6.9, 7.9, 8.9, 9.9, 12.9, 100]
    price_names2 = [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 13, 14]

    colors_names = ['#1f77b4', '#6D597A', '#E56B6F', '#f7b267']
    color_map = {
        '<5.5': colors_names[0],
        '5.5-7.5': colors_names[1],
        '7.5-10': colors_names[2],
        '10+': colors_names[3]
    }

    df['group'] = pd.cut(df['avg_price'], price_bins, labels=price_names)
    df['group2'] = pd.cut(df['avg_price'], price_bins1, labels=price_names2)
    df['color'] = df['group'].map(color_map)

    # clean up some player names
    player_names = {
        'Bernardo Silva': 'B. Silva',
        'David Silva': 'D. Silva',
        'Callum Wilson': 'C. Wilson',
        # 'Aubameyang': 'Auba',
        'Alexander-Arnold': 'Trent'
    }

    df['web_name'].replace(player_names, inplace=True)

    # player labels
    # TODO: make dynamic via season rank
    top_n = df[df['season'] == 2019].copy()
    top_n = top_n.nlargest(30, 'pts')
    df['label'] = df['fpl_player_code'].isin(top_n['fpl_player_code'])
    df['label'] = np.where(df['fpl_player_code'] == 37572, True, df['label'])
    df['label'] = np.where(df['fpl_player_code'] == 165153, True, df['label'])
    df['label'] = np.where(df['fpl_player_code'] == 141746, True, df['label'])
    df['label'] = np.where(df['fpl_player_code'] == 176413, True, df['label'])

    # clean up columns
    # df.rename(columns={'fpl': 'fpl_player_code'}, inplace=True)
    df.drop(['player_id', 'understat'], axis=1, inplace=True)

    # add fake mins to plot new players like Werner
    df['minutes'] = np.where(df['fpl_player_code'] == 165153, 3000, df['minutes'])
    return df


if __name__ == '__main__':
    data = get_xPTS_data()
    # data = understat_data()
    # print(data.to_string())
    # TODO: rename file
    # data.to_csv('data.csv', index=False)
