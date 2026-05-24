* Editing cell contents auto-resizes it in "real-time"

* For table layout editing, you must press [º] with 
the cursor touching a table line dash `-`

* Table layout change intentions are done writing 
dashes `-` or pipes `|` touching existing table lines `-`

* When [º] is pressed with the cursor next to a table line, a table simplifyng process is also done. 
    - It adjusts cell sizes to its content, removing extra paddings inside cells (the only padding left is one space after the left `|` and antoher before the right `|`. It also removes empty -or filled with space or tabs- lines at top of cell, and empty -or filled with space or tabs- lines at bottom of cell)
    - It removes unnecessary rowspans

* To create a single cell table, write `|-` and press TAB 

* To create a multi cell table write `|RxC` and press [º] (R is the number of rows and C is the number of columns). For example `|3x5` will create a table with 3 rows and 5 columns. 

