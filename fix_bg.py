from rembg import remove
from PIL import Image

for f in ['assets/obstacle.webp', 'assets/gem.webp', '/Users/char/.gemini/antigravity/brain/2fcd6dea-b7fa-4037-961e-78cf2cd26060/player_spritesheet_1772876462547.png']:
    try:
        input = Image.open(f)
        output = remove(input)
        
        if 'player_spritesheet' in f:
            output.save('assets/player_spritesheet.png')
        else:
            output.save(f)
        print(f"Processed {f}")
    except Exception as e:
        print(f"Error {f}: {e}")
