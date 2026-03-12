import psycopg2
try:
    conn = psycopg2.connect(
        host="192.168.208.97",
        database="munify_db",
        user="munify_user",
        password="munify_password"
    )
    cur = conn.cursor()
    cur.execute("SELECT id, title, (latex_source IS NOT NULL) as has_latex FROM documents;")
    rows = cur.fetchall()
    for row in rows:
        print(row)
    cur.close()
    conn.close()
except Exception as e:
    print(e)
